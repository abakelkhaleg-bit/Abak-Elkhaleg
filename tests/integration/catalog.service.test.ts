import { beforeEach, describe, expect, it } from "vitest";
import type { Types } from "mongoose";
import { buildSearchText } from "@/lib/arabic-normalize";
import { ProductModel } from "@/models/product";
import { listingQuerySchema, type ListingQuery } from "@/schemas/catalog";
import {
  getActiveCategoryBySlug,
  getPublishedProductBySlug,
  getRelatedProducts,
  listPublishedProducts,
  searchSuggestions,
} from "@/server/catalog.service";
import { createBrand, createCategory, productData } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("catalog-service");

const query = (overrides: Record<string, unknown> = {}): ListingQuery =>
  listingQuerySchema.parse(overrides);

async function seedCatalog() {
  const oud = await createCategory({ name: "العود", slug: "oud" });
  const musk = await createCategory({ name: "المسك", slug: "musk" });
  const hidden = await createCategory({ name: "مخفي", slug: "hidden", isActive: false });
  const brandA = await createBrand({ name: "دار العود", slug: "dar-oud" });
  const brandB = await createBrand({ name: "بيت المسك", slug: "musk-house" });

  const make = (
    name: string,
    slug: string,
    categoryId: Types.ObjectId,
    brandId: Types.ObjectId,
    variants: Array<Record<string, unknown>>,
    extra: Record<string, unknown> = {},
  ) =>
    ProductModel.create(
      productData(
        { categoryId, brandId },
        { name, slug, variants, isPublished: true, searchText: buildSearchText(name), ...extra },
      ),
    );

  const royal = await make("إطلالة ملكية", "royal", oud._id, brandA._id, [
    { sizeMl: 50, price: 50_000, compareAtPrice: 70_000, stockQuantity: 3 },
    { sizeMl: 100, price: 90_000, stockQuantity: 50 },
  ]);
  const white = await make("مسك أبيض", "white-musk", musk._id, brandB._id, [
    { sizeMl: 30, price: 20_000, stockQuantity: 0 },
  ]);
  const amber = await make("عنبر الليل", "amber", oud._id, brandB._id, [
    { sizeMl: 100, price: 120_000, stockQuantity: 5 },
    { sizeMl: 200, price: 10_000, stockQuantity: 5, isAvailable: false },
  ]);
  await make("مخفي في قسم مخفي", "in-hidden", hidden._id, brandA._id, [
    { sizeMl: 50, price: 40_000, stockQuantity: 5 },
  ]);
  await make(
    "مسودة",
    "draft",
    oud._id,
    brandA._id,
    [{ sizeMl: 50, price: 1_000, stockQuantity: 5 }],
    { isPublished: false },
  );
  return { oud, musk, hidden, brandA, brandB, royal, white, amber };
}

describe("listPublishedProducts", () => {
  beforeEach(async () => {
    await seedCatalog();
  });

  it("يعرض المنشور فقط", async () => {
    const result = await listPublishedProducts(query());
    expect(result.items.map((item) => item.slug)).not.toContain("draft");
    expect(result.total).toBe(4);
  });

  it("يفلتر حسب التصنيف والماركة بالـslug، والتصنيف المخفي لا يعطي نتائج", async () => {
    const byCategory = await listPublishedProducts(query({ category: "oud" }));
    expect(byCategory.items.map((i) => i.slug).sort()).toEqual(["amber", "royal"]);

    const byBrand = await listPublishedProducts(query({ brand: "musk-house" }));
    expect(byBrand.items.map((i) => i.slug).sort()).toEqual(["amber", "white-musk"]);

    expect((await listPublishedProducts(query({ category: "hidden" }))).total).toBe(0);
    expect((await listPublishedProducts(query({ category: "missing" }))).total).toBe(0);
  });

  it("يفلتر حسب السعر (بالجنيه في الرابط) والتوفر", async () => {
    const priced = await listPublishedProducts(query({ min: "300", max: "1000" }));
    expect(priced.items.map((i) => i.slug).sort()).toEqual(["in-hidden", "royal"]);

    const inStock = await listPublishedProducts(query({ inStock: "1" }));
    expect(inStock.items.map((i) => i.slug)).not.toContain("white-musk");
  });

  it("يرتب حسب السعر صعودًا وهبوطًا (أقل سعر متاح)", async () => {
    const asc = await listPublishedProducts(query({ sort: "price_asc" }));
    expect(asc.items.map((i) => i.price)).toEqual([20_000, 40_000, 50_000, 120_000]);
    const desc = await listPublishedProducts(query({ sort: "price_desc" }));
    expect(desc.items[0]?.slug).toBe("amber");
  });

  it("البحث العربي يتجاهل الهمزات والتاء المربوطة ويهرّب الرموز", async () => {
    const result = await listPublishedProducts(query({ q: "اطلاله" }));
    expect(result.items.map((i) => i.slug)).toEqual(["royal"]);
    const twoWords = await listPublishedProducts(query({ q: "مسك ابيض" }));
    expect(twoWords.items.map((i) => i.slug)).toEqual(["white-musk"]);
    await expect(listPublishedProducts(query({ q: "(.*" }))).resolves.toMatchObject({ total: 0 });
  });

  it("بطاقة المنتج: السعر الأقل والخصم والتوفر والماركة", async () => {
    const result = await listPublishedProducts(query({ category: "oud" }));
    expect(result.items.find((item) => item.slug === "royal")).toMatchObject({
      price: 50_000,
      compareAtPrice: 70_000,
      hasMultiplePrices: true,
      inStock: true,
      isOnSale: true,
      brandName: "دار العود",
    });
    // الحجم غير المتاح (200ml بسعر 100 ج.م) لا يدخل في أقل سعر
    expect(result.items.find((item) => item.slug === "amber")?.price).toBe(120_000);
  });

  it("الترقيم: 24 لكل صفحة ولا يُحمَّل أكثر من ذلك", async () => {
    const category = await createCategory({ slug: "bulk" });
    const brand = await createBrand();
    for (let i = 0; i < 30; i += 1) {
      await ProductModel.create(
        productData(
          { categoryId: category._id, brandId: brand._id },
          {
            slug: `bulk-${i}`,
            isPublished: true,
            variants: [{ sizeMl: 50, price: 1_000 + i, stockQuantity: 1 }],
          },
        ),
      );
    }
    const first = await listPublishedProducts(query({ category: "bulk" }));
    expect(first).toMatchObject({ total: 30, page: 1, pageCount: 2 });
    expect(first.items).toHaveLength(24);
    const second = await listPublishedProducts(query({ category: "bulk", page: "2" }));
    expect(second.items).toHaveLength(6);
    const beyond = await listPublishedProducts(query({ category: "bulk", page: "99" }));
    expect(beyond.page).toBe(2);
  });
});

describe("صفحة المنتج والمرتبطة والاقتراحات", () => {
  it("المنتج غير المنشور غير موجود للمتجر (E8 — طبقة الخدمة)", async () => {
    await seedCatalog();
    expect(await getPublishedProductBySlug("draft")).toBeNull();
    expect(await getPublishedProductBySlug("royal")).not.toBeNull();
  });

  it("الأحجام المتاحة فقط، مرتبة، ولكل حجم سعره وتوفره وحد الكمية (P10)", async () => {
    await seedCatalog();
    const amber = await getPublishedProductBySlug("amber");
    expect(amber?.variants.map((v) => v.sizeMl)).toEqual([100]);

    const royal = await getPublishedProductBySlug("royal");
    expect(royal?.variants).toEqual([
      expect.objectContaining({
        sizeMl: 50,
        price: 50_000,
        compareAtPrice: 70_000,
        inStock: true,
        maxQuantity: 3,
      }),
      // المخزون 50 لكن حد الطلب 20 — لا يُكشف رقم المخزون الفعلي
      expect.objectContaining({ sizeMl: 100, price: 90_000, compareAtPrice: null, maxQuantity: 20 }),
    ]);
    expect(royal?.category).toEqual({ name: "العود", slug: "oud" });

    const white = await getPublishedProductBySlug("white-musk");
    expect(white?.variants[0]).toMatchObject({ inStock: false, maxQuantity: 0 });
  });

  it("التصنيف المخفي لا يظهر في صفحة المنتج ولا كصفحة", async () => {
    await seedCatalog();
    expect((await getPublishedProductBySlug("in-hidden"))?.category).toBeNull();
    expect(await getActiveCategoryBySlug("hidden")).toBeNull();
  });

  it("المنتجات المرتبطة من نفس القسم ثم الماركة، بدون المنتج نفسه أو المسودات", async () => {
    const { royal } = await seedCatalog();
    const slugs = (await getRelatedProducts(royal._id.toString())).map((item) => item.slug);
    expect(slugs[0]).toBe("amber");
    expect(slugs).not.toContain("royal");
    expect(slugs).not.toContain("draft");
  });

  it("اقتراحات البحث للمنشور فقط", async () => {
    await seedCatalog();
    const suggestions = await searchSuggestions("مس");
    expect(suggestions.map((s) => s.slug)).toContain("white-musk");
    expect(suggestions.map((s) => s.slug)).not.toContain("draft");
    expect(suggestions.find((s) => s.slug === "white-musk")?.brandName).toBe("بيت المسك");
  });
});
