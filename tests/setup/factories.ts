import { Types } from "mongoose";
import { BrandModel } from "@/models/brand";
import { CategoryModel } from "@/models/category";
import type { Product, ProductImage } from "@/models/product";

/** بيانات اختبار صحيحة افتراضيًا؛ كل اختبار يغيّر فقط ما يختبره. */

let counter = 0;
const unique = () => {
  counter += 1;
  return counter;
};

export const VALID_ARGON2_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$K7YkL0eH2xFvTn6CwYgq3l9cZ1Jt8sQz0bHnRk4mVwE";

export const testImage = (n = 0) => ({
  secureUrl: `https://res.cloudinary.com/test-cloud/image/upload/v1/abak-elkhalig/products/img-${n}.jpg`,
  publicId: `abak-elkhalig/products/img-${n}`,
  altText: "صورة عطر",
  sortOrder: n,
});

export async function createCategory(overrides: Record<string, unknown> = {}) {
  const n = unique();
  return CategoryModel.create({ name: `تصنيف ${n}`, slug: `category-${n}`, ...overrides });
}

export async function createBrand(overrides: Record<string, unknown> = {}) {
  const n = unique();
  return BrandModel.create({ name: `ماركة ${n}`, slug: `brand-${n}`, ...overrides });
}

type ProductData = Partial<Omit<Product, "variants" | "images">> & {
  images?: Array<Omit<ProductImage, "_id">>;
  variants?: Array<Record<string, unknown>>;
};

export function productData(
  refs: { categoryId: Types.ObjectId; brandId: Types.ObjectId },
  overrides: ProductData = {},
) {
  const n = unique();
  return {
    name: `عطر تجريبي ${n}`,
    slug: `perfume-${n}`,
    shortDescription: "وصف مختصر",
    categoryId: refs.categoryId,
    brandId: refs.brandId,
    images: [testImage(0)],
    variants: [
      { sizeMl: 50, sku: `SKU-${n}-50`, price: 50_000, stockQuantity: 10, lowStockThreshold: 3 },
      { sizeMl: 100, sku: `SKU-${n}-100`, price: 90_000, stockQuantity: 4, lowStockThreshold: 3 },
    ],
    ...overrides,
  };
}

export async function createRefs() {
  const [category, brand] = await Promise.all([createCategory(), createBrand()]);
  return { categoryId: category._id, brandId: brand._id };
}

export const newObjectId = () => new Types.ObjectId();
