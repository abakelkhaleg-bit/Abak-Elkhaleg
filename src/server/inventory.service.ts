import "server-only";
import { Types, type ClientSession } from "mongoose";
import { escapeRegExp, normalizeArabic } from "@/lib/arabic-normalize";
import { connectToDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { MovementType } from "@/lib/validation-rules";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { ProductModel, type Product } from "@/models/product";
import { mongoose, trusted } from "@/models/_mongoose";
import { lowStockThresholdSchema, stockOperationSchema } from "@/schemas/inventory";
import { parseInput } from "@/server/admin/validate";
import { syncVariantNotifications } from "@/server/notifications.service";

/**
 * المخزون (docs/decisions/0006-inventory-concurrency.md):
 * كل تغيير يمر عبر changeVariantStock داخل معاملة: تحديث شرطي ذري (لا كمية سالبة،
 * لا بيع فوق المتاح) + حركة في السجل + مزامنة التنبيهات + تحديث inStock — معًا أو لا شيء.
 */

type WithId<T> = T & { _id: Types.ObjectId };

export type StockChange = {
  productId: string | Types.ObjectId;
  variantId: string | Types.ObjectId;
  delta: number;
  movementType: MovementType;
  reason?: string;
  orderId?: Types.ObjectId;
  /** تصحيح الجرد: يُنفذ فقط إن لم تتغير الكمية منذ قراءتها (قفل تفاؤلي). */
  expectedQuantity?: number;
};

export type StockChangeResult = {
  productName: string;
  sizeMl: number;
  previousQuantity: number;
  newQuantity: number;
};

/** النواة المشتركة (تُستخدم أيضًا لتأكيد/إلغاء الطلبات في المرحلة 6). يجب استدعاؤها داخل معاملة. */
export async function changeVariantStock(
  change: StockChange,
  session: ClientSession,
): Promise<StockChangeResult> {
  const productId = new Types.ObjectId(change.productId);
  const variantId = new Types.ObjectId(change.variantId);
  const condition =
    change.expectedQuantity !== undefined
      ? { _id: variantId, stockQuantity: change.expectedQuantity }
      : { _id: variantId, stockQuantity: { $gte: Math.max(0, -change.delta) } };

  const before = await ProductModel.findOneAndUpdate(
    { _id: productId, variants: trusted({ $elemMatch: condition }) },
    { $inc: { "variants.$[v].stockQuantity": change.delta } },
    { arrayFilters: [{ "v._id": variantId }], session, returnDocument: "before" },
  ).lean<WithId<Product>>();

  if (!before) {
    const current = await ProductModel.findById(productId, { name: 1, variants: 1 })
      .session(session)
      .lean<WithId<Product>>();
    const variant = current?.variants.find((v) => v._id.equals(variantId));
    if (!current || !variant) throw new AppError("NOT_FOUND", "العطر أو الحجم غير موجود.");
    if (change.expectedQuantity !== undefined) {
      throw new AppError("CONFLICT", "تغيّر المخزون أثناء العملية. أعد تحميل الصفحة وحاول مرة أخرى.");
    }
    throw new AppError(
      "INSUFFICIENT_STOCK",
      `الكمية غير كافية لـ${current.name} (${variant.sizeMl} مل). المتاح: ${variant.stockQuantity}.`,
    );
  }

  const variant = before.variants.find((v) => v._id.equals(variantId));
  if (!variant) throw new AppError("NOT_FOUND", "الحجم غير موجود.");
  const previousQuantity = variant.stockQuantity;
  const newQuantity = previousQuantity + change.delta;

  await InventoryMovementModel.create(
    [
      {
        productId,
        variantId,
        productName: before.name,
        sizeMl: variant.sizeMl,
        movementType: change.movementType,
        quantityDelta: change.delta,
        previousQuantity,
        newQuantity,
        ...(change.reason ? { reason: change.reason } : {}),
        ...(change.orderId ? { orderId: change.orderId } : {}),
      },
    ],
    { session },
  );

  const inStock = before.variants.some((v) =>
    v._id.equals(variantId) ? v.isAvailable && newQuantity > 0 : v.isAvailable && v.stockQuantity > 0,
  );
  await ProductModel.updateOne({ _id: productId }, { $set: { inStock } }, { session });

  await syncVariantNotifications(
    {
      productId,
      variantId,
      productName: before.name,
      sizeMl: variant.sizeMl,
      quantity: newQuantity,
      threshold: variant.lowStockThreshold,
      isAvailable: variant.isAvailable,
    },
    session,
  );

  return { productName: before.name, sizeMl: variant.sizeMl, previousQuantity, newQuantity };
}

/** عملية مخزون يدوية من لوحة الإدارة: توريد، أو تعديل بسبب، أو تصحيح جرد. */
export async function applyStockOperation(rawInput: unknown): Promise<StockChangeResult> {
  const input = parseInput(stockOperationSchema, rawInput);
  await connectToDatabase();

  let result: StockChangeResult | null = null;
  await mongoose.connection.transaction(async (session) => {
    if (input.type === "stocktake") {
      const product = await ProductModel.findById(input.productId, { variants: 1 })
        .session(session)
        .lean<WithId<Product>>();
      const variant = product?.variants.find((v) => v._id.toString() === input.variantId);
      if (!variant) throw new AppError("NOT_FOUND", "العطر أو الحجم غير موجود.");
      result = await changeVariantStock(
        {
          productId: input.productId,
          variantId: input.variantId,
          delta: input.newQuantity - variant.stockQuantity,
          movementType: "stocktake",
          reason: input.reason,
          expectedQuantity: variant.stockQuantity,
        },
        session,
      );
      return;
    }
    result = await changeVariantStock(
      {
        productId: input.productId,
        variantId: input.variantId,
        delta: input.type === "restock" ? input.quantity : input.delta,
        movementType: input.type,
        ...(input.reason ? { reason: input.reason } : {}),
      },
      session,
    );
  });
  if (!result) throw new Error("تعذر تحديث المخزون.");
  return result;
}

export async function setLowStockThreshold(rawInput: unknown): Promise<void> {
  const input = parseInput(lowStockThresholdSchema, rawInput);
  await connectToDatabase();
  await mongoose.connection.transaction(async (session) => {
    const variantId = new Types.ObjectId(input.variantId);
    const product = await ProductModel.findOneAndUpdate(
      { _id: input.productId, "variants._id": variantId },
      { $set: { "variants.$[v].lowStockThreshold": input.lowStockThreshold } },
      { arrayFilters: [{ "v._id": variantId }], session, returnDocument: "after" },
    ).lean<WithId<Product>>();
    const variant = product?.variants.find((v) => v._id.equals(variantId));
    if (!product || !variant) throw new AppError("NOT_FOUND", "العطر أو الحجم غير موجود.");
    await syncVariantNotifications(
      {
        productId: product._id,
        variantId,
        productName: product.name,
        sizeMl: variant.sizeMl,
        quantity: variant.stockQuantity,
        threshold: variant.lowStockThreshold,
        isAvailable: variant.isAvailable,
      },
      session,
    );
  });
}

// ─── عرض المخزون وسجل الحركات ────────────────────────────────────────────

export const INVENTORY_PAGE_SIZE = 25;

export type InventoryRow = {
  productId: string;
  variantId: string;
  productName: string;
  sizeMl: number;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  isPublished: boolean;
  status: "ok" | "low" | "out" | "unavailable";
};

export async function listInventory(options: {
  q?: string;
  filter?: "low" | "out";
  page: number;
}) {
  await connectToDatabase();
  const match: Record<string, unknown> = {};
  if (options.q) {
    const words = normalizeArabic(options.q).split(" ").filter(Boolean).slice(0, 5);
    match.$or = [
      { $and: words.map((word) => ({ searchText: { $regex: escapeRegExp(word) } })) },
      { "variants.sku": options.q.trim().toUpperCase() },
    ];
  }
  const variantMatch: Record<string, unknown> = {};
  if (options.filter === "out") {
    Object.assign(variantMatch, { "variants.isAvailable": true, "variants.stockQuantity": 0 });
  } else if (options.filter === "low") {
    Object.assign(variantMatch, {
      "variants.isAvailable": true,
      "variants.stockQuantity": { $gt: 0 },
      $expr: { $lte: ["$variants.stockQuantity", "$variants.lowStockThreshold"] },
    });
  }

  const pipeline = [
    ...(options.q ? [{ $match: match }] : []),
    { $unwind: "$variants" },
    ...(Object.keys(variantMatch).length > 0 ? [{ $match: variantMatch }] : []),
    { $sort: { "variants.stockQuantity": 1 as const, name: 1 as const } },
    {
      $facet: {
        total: [{ $count: "count" }],
        rows: [
          { $skip: (Math.max(1, options.page) - 1) * INVENTORY_PAGE_SIZE },
          { $limit: INVENTORY_PAGE_SIZE },
        ],
      },
    },
  ];
  // aggregate لا يمر بـ sanitizeFilter؛ مدخلات المستخدم هنا نص مُهرَّب فقط.
  const [facet] = await ProductModel.aggregate<{
    total: Array<{ count: number }>;
    rows: Array<WithId<Omit<Product, "variants">> & { variants: Product["variants"][number] }>;
  }>(pipeline);
  const total = facet?.total[0]?.count ?? 0;
  const items: InventoryRow[] = (facet?.rows ?? []).map((row) => {
    const v = row.variants;
    const status = !v.isAvailable
      ? "unavailable"
      : v.stockQuantity === 0
        ? "out"
        : v.stockQuantity <= v.lowStockThreshold
          ? "low"
          : "ok";
    return {
      productId: row._id.toString(),
      variantId: v._id.toString(),
      productName: row.name,
      sizeMl: v.sizeMl,
      sku: v.sku ?? null,
      stockQuantity: v.stockQuantity,
      lowStockThreshold: v.lowStockThreshold,
      isAvailable: v.isAvailable,
      isPublished: row.isPublished,
      status,
    };
  });
  return {
    items,
    total,
    page: Math.max(1, options.page),
    pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)),
  };
}

export const MOVEMENTS_PAGE_SIZE = 30;

export type MovementRow = {
  id: string;
  productId: string;
  productName: string;
  sizeMl: number;
  movementType: MovementType;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  createdAt: string;
};

export async function listMovements(options: { productId?: string; page: number }) {
  await connectToDatabase();
  const filter =
    options.productId && Types.ObjectId.isValid(options.productId)
      ? { productId: options.productId }
      : {};
  const total = await InventoryMovementModel.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page), pageCount);
  const docs = await InventoryMovementModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * MOVEMENTS_PAGE_SIZE)
    .limit(MOVEMENTS_PAGE_SIZE)
    .lean();
  const items: MovementRow[] = docs.map((doc) => ({
    id: doc._id.toString(),
    productId: doc.productId.toString(),
    productName: doc.productName,
    sizeMl: doc.sizeMl,
    movementType: doc.movementType,
    quantityDelta: doc.quantityDelta,
    previousQuantity: doc.previousQuantity,
    newQuantity: doc.newQuantity,
    reason: doc.reason ?? null,
    createdAt: doc.createdAt.toISOString(),
  }));
  return { items, total, page, pageCount };
}
