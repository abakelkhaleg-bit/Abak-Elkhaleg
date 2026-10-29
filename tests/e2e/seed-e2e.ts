/**
 * بيانات اختبارات E2E — تُحمَّل في قاعدة الذاكرة المؤقتة فقط (scripts/e2e-server.ts).
 * تبني على seed التطوير وتضيف حالات حدّية: منتج غير منشور، قسم مخفي، سياسة، وعدد كافٍ
 * من المنتجات لاختبار الترقيم.
 */
import { buildSearchText } from "@/lib/arabic-normalize";
import { BrandModel } from "@/models/brand";
import { CategoryModel } from "@/models/category";
import { ProductModel } from "@/models/product";
import { loadStoreSettings } from "@/models/store-settings";
import { createInitialAdmin } from "@/server/auth/admin-account.service";
import { seedDevData } from "../../scripts/seed/dev-data";
import { E2E } from "./e2e-data";

const IMAGE = {
  secureUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
  publicId: "sample",
  altText: "عطر",
  sortOrder: 0,
};

export async function seedE2EData(): Promise<void> {
  await seedDevData();

  const brand = await BrandModel.create({ name: "ماركة الاختبار", slug: "e2e-brand" });
  const hidden = await CategoryModel.create({
    name: "قسم مخفي",
    slug: E2E.hiddenCategorySlug,
    isActive: false,
  });
  const bulk = await CategoryModel.create({ name: "اختبار الترقيم", slug: E2E.bulkCategorySlug });

  await ProductModel.create({
    name: "مسودة غير منشورة",
    slug: E2E.draftSlug,
    shortDescription: "لا يجب أن يظهر",
    categoryId: hidden._id,
    brandId: brand._id,
    images: [IMAGE],
    variants: [{ sizeMl: 50, price: 1_000, stockQuantity: 5 }],
    isPublished: false,
  });

  for (let i = 1; i <= E2E.bulkCount; i += 1) {
    const name = `عطر اختبار ${i}`;
    await ProductModel.create({
      name,
      slug: `e2e-perfume-${i}`,
      shortDescription: "منتج لاختبار الترقيم",
      categoryId: bulk._id,
      brandId: brand._id,
      images: [IMAGE],
      variants: [{ sizeMl: 50, price: 200_000 + i * 100, stockQuantity: 5 }],
      isPublished: true,
      searchText: buildSearchText(name, brand.name, bulk.name),
    });
  }

  await ProductModel.create({
    name: E2E.adminDraft.name,
    slug: E2E.adminDraft.slug,
    shortDescription: "منتج غير منشور لاختبار النشر من لوحة الإدارة",
    categoryId: hidden._id,
    brandId: brand._id,
    images: [IMAGE],
    variants: [{ sizeMl: 50, price: 30_000, stockQuantity: 5 }],
    isPublished: false,
    searchText: buildSearchText(E2E.adminDraft.name, brand.name, hidden.name),
  });

  await createInitialAdmin({ username: E2E.admin.username, password: E2E.admin.password });

  const settings = await loadStoreSettings();
  settings.policies.push({
    slug: E2E.policy.slug,
    title: E2E.policy.title,
    body: "نوصل الطلبات لكل محافظات مصر.\n\nتُحدد رسوم التوصيل عند تأكيد الطلب.",
  });
  await settings.save();
}
