import "server-only";
import { Types } from "mongoose";
import { buildSearchText, escapeRegExp, normalizeArabic } from "@/lib/arabic-normalize";
import { connectToDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { BrandModel } from "@/models/brand";
import { CategoryModel } from "@/models/category";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { NotificationModel } from "@/models/notification";
import { ProductModel, type Product } from "@/models/product";
import { mongoose, trusted } from "@/models/_mongoose";
import { withSlugFallback } from "@/schemas/common";
import { productInputSchema, type ProductInput } from "@/schemas/product";
import { assertObjectId, parseInput } from "@/server/admin/validate";
import { assertKnownImages, deleteUnusedImages, markAttached } from "@/server/media.service";

/**
 * إدارة المنتجات. المخزون لا يُعدَّل من هنا بعد الإنشاء؛ الكمية الأولية لكل حجم جديد
 * تُسجَّل كحركة "initial" في نفس المعاملة. التعديلات اللاحقة عبر خدمة المخزون (المرحلة 5).
 */

export const ADMIN_PAGE_SIZE = 20;

type WithId<T> = T & { _id: Types.ObjectId };

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  brandName: string | null;
  categoryName: string | null;
  image: string | null;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  variantCount: number;
  isPublished: boolean;
  isFeatured: boolean;
  isOnSale: boolean;
  hasOutOfStock: boolean;
  hasLowStock: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type AdminProductQuery = {
  q?: string;
  categoryId?: string;
  brandId?: string;
  status?: "published" | "draft";
  stock?: "out" | "low";
  page: number;
};

export async function listProductsForAdmin(query: AdminProductQuery) {
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (query.q) {
    const words = normalizeArabic(query.q).split(" ").filter(Boolean).slice(0, 5);
    const clauses = words.map((word) => ({ searchText: trusted({ $regex: escapeRegExp(word) }) }));
    const sku = query.q.trim().toUpperCase();
    filter.$or = [
      ...(clauses.length > 0 ? [{ $and: clauses }] : []),
      { "variants.sku": sku },
      { slug: query.q.trim() },
    ];
  }
  if (query.categoryId && Types.ObjectId.isValid(query.categoryId)) filter.categoryId = query.categoryId;
  if (query.brandId && Types.ObjectId.isValid(query.brandId)) filter.brandId = query.brandId;
  if (query.status) filter.isPublished = query.status === "published";
  if (query.stock === "out") {
    filter.variants = trusted({ $elemMatch: { isAvailable: true, stockQuantity: 0 } });
  } else if (query.stock === "low") {
    filter.$expr = trusted({
      $gt: [
        {
          $size: {
            $filter: {
              input: "$variants",
              as: "v",
              cond: {
                $and: [
                  { $eq: ["$$v.isAvailable", true] },
                  { $gt: ["$$v.stockQuantity", 0] },
                  { $lte: ["$$v.stockQuantity", "$$v.lowStockThreshold"] },
                ],
              },
            },
          },
        },
        0,
      ],
    });
  }

  const total = await ProductModel.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const products = await ProductModel.find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .skip((page - 1) * ADMIN_PAGE_SIZE)
    .limit(ADMIN_PAGE_SIZE)
    .lean<Array<WithId<Product>>>();

  const [brands, categories] = await Promise.all([
    BrandModel.find({ _id: trusted({ $in: products.map((p) => p.brandId) }) }, { name: 1 }).lean(),
    CategoryModel.find({ _id: trusted({ $in: products.map((p) => p.categoryId) }) }, { name: 1 }).lean(),
  ]);
  const brandNames = new Map(brands.map((b) => [b._id.toString(), b.name]));
  const categoryNames = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const items: AdminProductRow[] = products.map((product) => {
    const prices = product.variants.map((v) => v.price);
    const image = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return {
      id: product._id.toString(),
      name: product.name,
      slug: product.slug,
      brandName: brandNames.get(product.brandId.toString()) ?? null,
      categoryName: categoryNames.get(product.categoryId.toString()) ?? null,
      image: image?.secureUrl ?? null,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      totalStock: product.variants.reduce((sum, v) => sum + v.stockQuantity, 0),
      variantCount: product.variants.length,
      isPublished: product.isPublished,
      isFeatured: product.isFeatured,
      isOnSale: product.isOnSale,
      hasOutOfStock: product.variants.some((v) => v.isAvailable && v.stockQuantity === 0),
      hasLowStock: product.variants.some(
        (v) => v.isAvailable && v.stockQuantity > 0 && v.stockQuantity <= v.lowStockThreshold,
      ),
      sortOrder: product.sortOrder,
      updatedAt: product.updatedAt.toISOString(),
    };
  });
  return { items, total, page, pageCount };
}

export type ProductEditData = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  brandId: string;
  isPublished: boolean;
  isFeatured: boolean;
  hideFromOffers: boolean;
  sortOrder: number;
  seo: { title: string; description: string };
  images: Array<{ secureUrl: string; publicId: string; altText: string }>;
  variants: Array<{
    id: string;
    sizeMl: number;
    sku: string;
    price: number;
    compareAtPrice: number | null;
    stockQuantity: number;
    lowStockThreshold: number;
    isAvailable: boolean;
  }>;
};

export async function getProductForEdit(id: string): Promise<ProductEditData | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();
  const product = await ProductModel.findById(id).lean<WithId<Product>>();
  if (!product) return null;
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    categoryId: product.categoryId.toString(),
    brandId: product.brandId.toString(),
    isPublished: product.isPublished,
    isFeatured: product.isFeatured,
    hideFromOffers: product.hideFromOffers,
    sortOrder: product.sortOrder,
    seo: { title: product.seo?.title ?? "", description: product.seo?.description ?? "" },
    images: [...product.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => ({
        secureUrl: image.secureUrl,
        publicId: image.publicId,
        altText: image.altText,
      })),
    variants: product.variants.map((variant) => ({
      id: variant._id.toString(),
      sizeMl: variant.sizeMl,
      sku: variant.sku ?? "",
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? null,
      stockQuantity: variant.stockQuantity,
      lowStockThreshold: variant.lowStockThreshold,
      isAvailable: variant.isAvailable,
    })),
  };
}

async function loadTaxonomy(input: Pick<ProductInput, "categoryId" | "brandId">) {
  const [category, brand] = await Promise.all([
    CategoryModel.findById(input.categoryId, { name: 1 }).lean(),
    BrandModel.findById(input.brandId, { name: 1 }).lean(),
  ]);
  const fieldErrors: Record<string, string[]> = {};
  if (!category) fieldErrors.categoryId = ["التصنيف غير موجود."];
  if (!brand) fieldErrors.brandId = ["الماركة غير موجودة."];
  if (!category || !brand) throw new AppError("VALIDATION", "تحقق من البيانات المدخلة.", fieldErrors);
  return { categoryName: category.name, brandName: brand.name };
}

function baseFields(input: ProductInput, names: { categoryName: string; brandName: string }) {
  const withSlug = withSlugFallback(input);
  return {
    name: input.name,
    slug: withSlug.slug,
    shortDescription: input.shortDescription,
    description: input.description ?? "",
    categoryId: new Types.ObjectId(input.categoryId),
    brandId: new Types.ObjectId(input.brandId),
    isPublished: input.isPublished,
    isFeatured: input.isFeatured,
    hideFromOffers: input.hideFromOffers,
    sortOrder: input.sortOrder,
    seo: { title: input.seo.title, description: input.seo.description },
    searchText: buildSearchText(input.name, names.brandName, names.categoryName),
  };
}

function imageList(images: ProductInput["images"]) {
  return images.map((image, index) => ({ ...image, sortOrder: index }));
}

function initialMovements(product: WithId<Product> | Product & { _id: Types.ObjectId }, variantIds: Set<string>) {
  return product.variants
    .filter((variant) => variantIds.has(variant._id.toString()) && variant.stockQuantity > 0)
    .map((variant) => ({
      productId: product._id,
      variantId: variant._id,
      productName: product.name,
      sizeMl: variant.sizeMl,
      movementType: "initial" as const,
      quantityDelta: variant.stockQuantity,
      previousQuantity: 0,
      newQuantity: variant.stockQuantity,
    }));
}

export async function createProduct(rawInput: unknown): Promise<{ id: string; slug: string }> {
  const input = parseInput(productInputSchema, rawInput);
  await connectToDatabase();
  const names = await loadTaxonomy(input);
  const newImageIds = await assertKnownImages(input.images, []);

  let created: { id: string; slug: string } | null = null;
  await mongoose.connection.transaction(async (session) => {
    const variants = input.variants.map((variant) => ({
      _id: new Types.ObjectId(),
      sizeMl: variant.sizeMl,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      stockQuantity: variant.initialStock,
      lowStockThreshold: variant.lowStockThreshold,
      isAvailable: variant.isAvailable,
    }));
    const [product] = await ProductModel.create(
      [{ ...baseFields(input, names), images: imageList(input.images), variants }],
      { session },
    );
    if (!product) throw new Error("تعذر إنشاء المنتج.");
    const movements = initialMovements(
      product.toObject() as WithId<Product>,
      new Set(variants.map((v) => v._id.toString())),
    );
    if (movements.length > 0) await InventoryMovementModel.create(movements, { session, ordered: true });
    created = { id: product._id.toString(), slug: product.slug };
  });
  if (!created) throw new Error("تعذر إنشاء المنتج.");
  await markAttached(newImageIds);
  return created;
}

export async function updateProduct(
  rawId: unknown,
  rawInput: unknown,
): Promise<{ id: string; slug: string }> {
  const id = assertObjectId(rawId, "المنتج");
  const input = parseInput(productInputSchema, rawInput);
  await connectToDatabase();
  const names = await loadTaxonomy(input);

  let updated: { id: string; slug: string } | null = null;
  let newImageIds: string[] = [];
  let removedImageIds: string[] = [];
  await mongoose.connection.transaction(async (session) => {
    const product = await ProductModel.findById(id).session(session);
    if (!product) throw new AppError("NOT_FOUND", "المنتج غير موجود أو حُذف.");

    // الصور: الموجودة أو المرفوعة عبر مدير الصور فقط (MediaAsset)؛ لا روابط يدوية.
    const existingImageIds = product.images.map((image) => image.publicId);
    newImageIds = await assertKnownImages(input.images, existingImageIds);
    removedImageIds = existingImageIds.filter(
      (publicId) => !input.images.some((image) => image.publicId === publicId),
    );

    const existing = new Map(product.variants.map((variant) => [variant._id.toString(), variant]));
    const newVariantIds = new Set<string>();
    const variants = input.variants.map((variant) => {
      const current = variant.id ? existing.get(variant.id) : undefined;
      if (variant.id && !current) {
        throw new AppError("VALIDATION", "أحد الأحجام لم يعد موجودًا، أعد تحميل الصفحة.");
      }
      const _id = current?._id ?? new Types.ObjectId();
      if (!current) newVariantIds.add(_id.toString());
      return {
        _id,
        sizeMl: variant.sizeMl,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        // المخزون الحالي لا يُغيّر من هنا؛ فقط الأحجام الجديدة تأخذ كميتها الأولية.
        stockQuantity: current ? current.stockQuantity : variant.initialStock,
        lowStockThreshold: variant.lowStockThreshold,
        isAvailable: variant.isAvailable,
      };
    });

    product.set({ ...baseFields(input, names), images: imageList(input.images), variants });
    await product.save({ session });

    const movements = initialMovements(product.toObject() as WithId<Product>, newVariantIds);
    if (movements.length > 0) await InventoryMovementModel.create(movements, { session, ordered: true });

    // أحجام حُذفت: تُغلق تنبيهاتها المفتوحة (السجل يبقى).
    const removedIds = [...existing.keys()].filter((key) => !variants.some((v) => v._id.toString() === key));
    if (removedIds.length > 0) {
      await NotificationModel.updateMany(
        { productId: product._id, variantId: trusted({ $in: removedIds }), isOpen: true },
        { isOpen: false, resolvedAt: new Date() },
        { session },
      );
    }
    updated = { id: product._id.toString(), slug: product.slug };
  });
  if (!updated) throw new Error("تعذر حفظ المنتج.");
  await markAttached(newImageIds);
  await deleteUnusedImages(removedImageIds);
  return updated;
}

export async function setProductFlag(
  rawId: unknown,
  flag: "isPublished" | "isFeatured",
  value: boolean,
): Promise<void> {
  const id = assertObjectId(rawId, "المنتج");
  await connectToDatabase();
  const product = await ProductModel.findById(id);
  if (!product) throw new AppError("NOT_FOUND", "المنتج غير موجود أو حُذف.");
  product.set(flag, value);
  await product.save(); // قواعد النشر (صورة وحجم متاح) تُطبق في pre('validate')
}

export async function deleteProduct(rawId: unknown): Promise<void> {
  const id = assertObjectId(rawId, "المنتج");
  await connectToDatabase();
  const existing = await ProductModel.findById(id, { images: 1 }).lean<
    WithId<Pick<Product, "images">>
  >();
  const imageIds = existing?.images.map((image) => image.publicId) ?? [];
  await mongoose.connection.transaction(async (session) => {
    const result = await ProductModel.deleteOne({ _id: id }, { session });
    if (result.deletedCount === 0) throw new AppError("NOT_FOUND", "المنتج غير موجود أو حُذف.");
    await NotificationModel.updateMany(
      { productId: id, isOpen: true },
      { isOpen: false, resolvedAt: new Date() },
      { session },
    );
  });
  // بعد نجاح الحذف: تُحذف من Cloudinary فقط الصور التي لم تعد مستخدمة في أي مكان.
  await deleteUnusedImages(imageIds);
}

/** يعيد حساب نص البحث لكل منتجات تصنيف أو ماركة بعد تغيير اسمها. */
export async function refreshSearchTextFor(filter: { categoryId?: string; brandId?: string }) {
  await connectToDatabase();
  const products = await ProductModel.find(filter, { name: 1, categoryId: 1, brandId: 1 }).lean<
    Array<WithId<Pick<Product, "name" | "categoryId" | "brandId">>>
  >();
  if (products.length === 0) return 0;
  const [brands, categories] = await Promise.all([
    BrandModel.find({ _id: trusted({ $in: products.map((p) => p.brandId) }) }, { name: 1 }).lean(),
    CategoryModel.find({ _id: trusted({ $in: products.map((p) => p.categoryId) }) }, { name: 1 }).lean(),
  ]);
  const brandNames = new Map(brands.map((b) => [b._id.toString(), b.name]));
  const categoryNames = new Map(categories.map((c) => [c._id.toString(), c.name]));
  await ProductModel.bulkWrite(
    products.map((product) => ({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            searchText: buildSearchText(
              product.name,
              brandNames.get(product.brandId.toString()),
              categoryNames.get(product.categoryId.toString()),
            ),
          },
        },
      },
    })),
  );
  return products.length;
}
