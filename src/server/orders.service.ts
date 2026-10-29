import "server-only";
import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { getSecurityEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { multiplyPiasters } from "@/lib/money";
import type { OrderStatus } from "@/lib/validation-rules";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp-message";
import { formatOrderReference, nextSequence } from "@/models/counter";
import { OrderRequestModel, type OrderItem, type OrderRequest } from "@/models/order-request";
import { ProductModel, type Product } from "@/models/product";
import { loadStoreSettings } from "@/models/store-settings";
import { mongoose, trusted } from "@/models/_mongoose";
import { createOrderInputSchema } from "@/schemas/order";
import { assertObjectId, parseInput } from "@/server/admin/validate";
import { changeVariantStock } from "@/server/inventory.service";
import { consumeRateLimit, RATE_LIMITS } from "@/server/rate-limit";

/**
 * الطلبات عبر واتساب (docs/decisions/0003-order-requests.md):
 * - الإنشاء: أسعار وتوفر من القاعدة فقط (W1)، طلب أولي opened_in_whatsapp، **بلا خصم مخزون** (S6).
 * - التأكيد: يخصم المخزون لكل البنود داخل معاملة واحدة، أو لا شيء (S4)، ومرة واحدة فقط (S7).
 * - الإلغاء: يعيد المخزون إن كان الطلب مؤكدًا (S13).
 * - "منتهي" حالة عرض فقط: مفتوح وأقدم من 7 أيام، ويبقى قابلًا للتأكيد.
 */

export const ORDER_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type WithId<T> = T & { _id: Types.ObjectId };

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${getSecurityEnv().IP_HASH_SALT}:${ip}`).digest("hex");
}

export type CreatedOrder = { reference: string; whatsappUrl: string; total: number };

export async function createOrderRequest(
  rawInput: unknown,
  context: { ip: string },
): Promise<CreatedOrder> {
  const ipHash = hashIp(context.ip);
  const limit = await consumeRateLimit("order", ipHash, RATE_LIMITS.order);
  if (!limit.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      "أنشأت طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.",
    );
  }

  // أي سعر أو إجمالي يرسله المتصفح يُحذف هنا (Zod يزيل الحقول غير المعرّفة).
  const input = parseInput(createOrderInputSchema, rawInput);
  await connectToDatabase();

  const settings = await loadStoreSettings();
  if (!settings.whatsappNumber) {
    throw new AppError(
      "WHATSAPP_NOT_CONFIGURED",
      "الطلب عبر واتساب غير متاح حاليًا. تواصل مع المتجر بالطرق الأخرى.",
    );
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await ProductModel.find(
    { _id: trusted({ $in: productIds }), isPublished: true },
    { name: 1, slug: 1, variants: 1 },
  ).lean<Array<WithId<Pick<Product, "name" | "slug" | "variants">>>>();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  const fieldErrors: Record<string, string[]> = {};
  const items: OrderItem[] = [];
  input.items.forEach((item, index) => {
    const product = byId.get(item.productId);
    if (!product) {
      fieldErrors[`items.${index}`] = ["هذا العطر لم يعد متاحًا."];
      return;
    }
    const variant = product.variants.find((v) => v._id.toString() === item.variantId);
    if (!variant || !variant.isAvailable) {
      fieldErrors[`items.${index}`] = [`حجم ${product.name} المطلوب غير متاح.`];
      return;
    }
    if (item.quantity > variant.stockQuantity) {
      fieldErrors[`items.${index}`] = [
        `الكمية المتاحة من ${product.name} (${variant.sizeMl} مل): ${variant.stockQuantity}.`,
      ];
      return;
    }
    items.push({
      productId: product._id,
      variantId: variant._id,
      productName: product.name,
      slug: product.slug,
      sizeMl: variant.sizeMl,
      unitPrice: variant.price,
      quantity: item.quantity,
      lineTotal: multiplyPiasters(variant.price, item.quantity),
    });
  });
  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(
      "CART_CHANGED",
      "تغيّر توفر بعض المنتجات. راجع السلة ثم أعد المحاولة.",
      fieldErrors,
    );
  }

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const reference = formatOrderReference(await nextSequence("order"));
  const customer = {
    name: input.customer.name,
    phone: input.customer.phone,
    governorate: input.customer.governorate,
    ...(input.customer.address ? { address: input.customer.address } : {}),
    ...(input.customer.notes ? { notes: input.customer.notes } : {}),
  };
  await OrderRequestModel.create({ reference, items, total, customer, ipHash });

  const message = buildOrderMessage({
    reference,
    storeName: settings.storeName,
    items,
    total,
    customer,
  });
  return { reference, whatsappUrl: buildWhatsAppUrl(settings.whatsappNumber, message), total };
}

// ─── إدارة الطلبات ──────────────────────────────────────────────────────

async function loadOrder(rawId: unknown) {
  const id = assertObjectId(rawId, "الطلب");
  await connectToDatabase();
  const order = await OrderRequestModel.findById(id);
  if (!order) throw new AppError("NOT_FOUND", "الطلب غير موجود.");
  return order;
}

/** تأكيد طلب مفتوح: خصم كل البنود ذريًا. التحديث الشرطي للحالة يمنع الخصم المكرر (S7). */
export async function confirmOrder(rawId: unknown): Promise<void> {
  const id = assertObjectId(rawId, "الطلب");
  await connectToDatabase();
  await mongoose.connection.transaction(async (session) => {
    const now = new Date();
    const order = await OrderRequestModel.findOneAndUpdate(
      { _id: id, status: "opened_in_whatsapp" },
      {
        $set: { status: "confirmed", confirmedAt: now },
        $push: { statusHistory: { status: "confirmed", at: now } },
      },
      { session, returnDocument: "after" },
    );
    if (!order) {
      const existing = await OrderRequestModel.findById(id, { status: 1 }).session(session);
      if (!existing) throw new AppError("NOT_FOUND", "الطلب غير موجود.");
      throw new AppError(
        "CONFLICT",
        existing.status === "confirmed" ? "الطلب مؤكد بالفعل." : "لا يمكن تأكيد طلب ملغى.",
      );
    }
    for (const item of order.items) {
      await changeVariantStock(
        {
          productId: item.productId,
          variantId: item.variantId,
          delta: -item.quantity,
          movementType: "sale",
          orderId: order._id,
        },
        session,
      );
    }
  });
}

/** إلغاء طلب مفتوح أو مؤكد. المؤكد يعيد مخزونه بحركة order_cancel_restore (S13). */
export async function cancelOrder(rawId: unknown): Promise<void> {
  const id = assertObjectId(rawId, "الطلب");
  await connectToDatabase();
  await mongoose.connection.transaction(async (session) => {
    const now = new Date();
    const before = await OrderRequestModel.findOneAndUpdate(
      { _id: id, status: trusted({ $in: ["opened_in_whatsapp", "confirmed"] }) },
      {
        $set: { status: "cancelled", cancelledAt: now },
        $push: { statusHistory: { status: "cancelled", at: now } },
      },
      { session, returnDocument: "before" },
    );
    if (!before) {
      const existing = await OrderRequestModel.findById(id, { status: 1 }).session(session);
      if (!existing) throw new AppError("NOT_FOUND", "الطلب غير موجود.");
      throw new AppError("CONFLICT", "الطلب ملغى بالفعل.");
    }
    if (before.status !== "confirmed") return;
    for (const item of before.items) {
      // الحجم قد يكون حُذف من المنتج بعد البيع؛ حينها لا يوجد مخزون يُعاد.
      const exists = await ProductModel.exists({
        _id: item.productId,
        "variants._id": item.variantId,
      }).session(session);
      if (!exists) continue;
      await changeVariantStock(
        {
          productId: item.productId,
          variantId: item.variantId,
          delta: item.quantity,
          movementType: "order_cancel_restore",
          orderId: before._id,
        },
        session,
      );
    }
  });
}

/** حذف البيانات الشخصية للعميل (SECURITY §10). البنود والإجمالي والحالة تبقى. */
export async function purgeOrderPii(rawId: unknown): Promise<void> {
  const order = await loadOrder(rawId);
  if (order.piiPurgedAt) return;
  order.set({ customer: {}, piiPurgedAt: new Date(), ipHash: undefined });
  await order.save();
}

/** حذف PII من كل الطلبات الأقدم من عدد أيام (orders:purge-pii). */
export async function purgePiiOlderThan(days: number): Promise<number> {
  if (!Number.isInteger(days) || days < 1) throw new Error("عدد الأيام يجب أن يكون صحيحًا موجبًا.");
  await connectToDatabase();
  const result = await OrderRequestModel.updateMany(
    {
      piiPurgedAt: trusted({ $exists: false }),
      createdAt: trusted({ $lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }),
    },
    { $set: { customer: {}, piiPurgedAt: new Date() }, $unset: { ipHash: 1 } },
  );
  return result.modifiedCount;
}

// ─── العرض في الإدارة ───────────────────────────────────────────────────

export type OrderDisplayStatus = OrderStatus | "expired";
export const ORDER_FILTERS = ["open", "expired", "confirmed", "cancelled"] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export function displayStatus(order: Pick<OrderRequest, "status" | "createdAt">, now = Date.now()) {
  return order.status === "opened_in_whatsapp" && now - order.createdAt.getTime() > ORDER_EXPIRY_MS
    ? "expired"
    : order.status;
}

export type AdminOrderRow = {
  id: string;
  reference: string;
  status: OrderDisplayStatus;
  total: number;
  items: Array<{ productName: string; sizeMl: number; quantity: number; lineTotal: number; productId: string }>;
  customer: { name?: string; phone?: string; governorate?: string; address?: string; notes?: string };
  piiPurged: boolean;
  createdAt: string;
  history: Array<{ status: OrderStatus; at: string }>;
};

export const ORDERS_PAGE_SIZE = 20;

export async function listOrders(options: { filter?: OrderFilter; q?: string; page: number }) {
  await connectToDatabase();
  const cutoff = new Date(Date.now() - ORDER_EXPIRY_MS);
  const filter: Record<string, unknown> = {};
  if (options.filter === "open") Object.assign(filter, { status: "opened_in_whatsapp", createdAt: trusted({ $gte: cutoff }) });
  if (options.filter === "expired") Object.assign(filter, { status: "opened_in_whatsapp", createdAt: trusted({ $lt: cutoff }) });
  if (options.filter === "confirmed" || options.filter === "cancelled") filter.status = options.filter;
  const q = options.q?.trim().toUpperCase();
  if (q) filter.reference = /^AK-\d+$/.test(q) ? q : `AK-${q.replace(/\D/g, "").padStart(6, "0")}`;

  const total = await OrderRequestModel.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page), pageCount);
  const docs = await OrderRequestModel.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * ORDERS_PAGE_SIZE)
    .limit(ORDERS_PAGE_SIZE)
    .lean();
  const now = Date.now();
  const items: AdminOrderRow[] = docs.map((doc) => ({
    id: doc._id.toString(),
    reference: doc.reference,
    status: displayStatus(doc, now),
    total: doc.total,
    items: doc.items.map((item) => ({
      productName: item.productName,
      sizeMl: item.sizeMl,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      productId: item.productId.toString(),
    })),
    customer: { ...doc.customer },
    piiPurged: Boolean(doc.piiPurgedAt),
    createdAt: doc.createdAt.toISOString(),
    history: doc.statusHistory.map((h) => ({ status: h.status, at: h.at.toISOString() })),
  }));
  return { items, total, page, pageCount };
}

export async function countOrdersByStatus() {
  await connectToDatabase();
  const cutoff = new Date(Date.now() - ORDER_EXPIRY_MS);
  const [open, expired, confirmed] = await Promise.all([
    OrderRequestModel.countDocuments({ status: "opened_in_whatsapp", createdAt: trusted({ $gte: cutoff }) }),
    OrderRequestModel.countDocuments({ status: "opened_in_whatsapp", createdAt: trusted({ $lt: cutoff }) }),
    OrderRequestModel.countDocuments({ status: "confirmed" }),
  ]);
  return { open, expired, confirmed };
}
