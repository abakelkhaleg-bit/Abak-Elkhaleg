import { describe, expect, it } from "vitest";
import { toAppError } from "@/lib/errors";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { MediaAssetModel } from "@/models/media-asset";
import { NotificationModel } from "@/models/notification";
import { ProductModel } from "@/models/product";
import { StoreSettingsModel } from "@/models/store-settings";
import { getDashboardStats } from "@/server/admin/dashboard.service";
import {
  createProduct,
  deleteProduct,
  getProductForEdit,
  listProductsForAdmin,
  setProductFlag,
  updateProduct,
} from "@/server/admin/products.admin.service";
import { getSettingsForEdit, updateSettings } from "@/server/admin/settings.admin.service";
import {
  createTaxonomy,
  deleteTaxonomy,
  listTaxonomyForAdmin,
  updateTaxonomy,
} from "@/server/admin/taxonomy.admin.service";
import { newObjectId, testImage } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("admin-services");

async function refs() {
  const category = await createTaxonomy("category", { name: "العود" });
  const brand = await createTaxonomy("brand", { name: "دار العود" });
  // الخدمة تقبل فقط صورًا رُفعت عبر مدير الصور؛ نسجلها كما يفعل الرفع الحقيقي.
  await MediaAssetModel.create(
    [1, 2, 3, 5].map((n) => ({
      publicId: testImage(n).publicId,
      secureUrl: testImage(n).secureUrl,
      format: "jpg",
      bytes: 1024,
      width: 800,
      height: 800,
      folder: "products" as const,
    })),
  );
  return { categoryId: category.id, brandId: brand.id };
}

const productInput = (r: { categoryId: string; brandId: string }, overrides = {}) => ({
  name: "عود الإمارة",
  shortDescription: "عود فاخر",
  categoryId: r.categoryId,
  brandId: r.brandId,
  variants: [
    { sizeMl: 50, price: 50_000, compareAtPrice: 60_000, initialStock: 4, lowStockThreshold: 3 },
    { sizeMl: 100, price: 90_000, initialStock: 0 },
  ],
  ...overrides,
});

describe("إدارة المنتجات", () => {
  it("ينشئ منتجًا مع slug مقترح ونص بحث وحركات كمية أولية (P1)", async () => {
    const r = await refs();
    const { id, slug } = await createProduct(productInput(r));
    expect(slug).toBe("عود-الإمارة");
    const product = await ProductModel.findById(id).orFail();
    expect(product.searchText).toBe("عود الاماره دار العود العود");
    expect(product.variants.map((v) => v.stockQuantity)).toEqual([4, 0]);
    const movements = await InventoryMovementModel.find({ productId: id });
    expect(movements.map((m) => [m.movementType, m.newQuantity])).toEqual([["initial", 4]]);
  });

  it("يرفض مراجع غير موجودة وslug مكررًا (P5) ومدخلات غير صالحة (P2–P4)", async () => {
    const r = await refs();
    await expect(
      createProduct(productInput({ ...r, categoryId: newObjectId().toString() })),
    ).rejects.toMatchObject({ fieldErrors: { categoryId: ["التصنيف غير موجود."] } });

    await createProduct(productInput(r));
    // الخدمة ترمي خطأ القاعدة؛ طبقة الـActions تترجمه عبر toAppError (كما هنا)
    const duplicate = await createProduct(productInput(r)).catch((e: unknown) => e);
    expect(toAppError(duplicate).message).toContain("الرابط (slug) مستخدم بالفعل");

    await expect(
      createProduct(productInput(r, { variants: [{ sizeMl: 50, price: 100, compareAtPrice: 50 }] })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createProduct({ name: "x" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("التعديل لا يغيّر مخزون الأحجام الحالية، والحجم الجديد يأخذ كميته الأولية بحركة (P7)", async () => {
    const r = await refs();
    const { id } = await createProduct(productInput(r));
    const before = await getProductForEdit(id);
    const [small, large] = before?.variants ?? [];
    if (!small || !large) throw new Error("setup");

    await NotificationModel.create({
      type: "out_of_stock",
      productId: id,
      variantId: large.id,
      productName: "عود",
      sizeMl: 100,
      quantityAtTrigger: 0,
      message: "نفد",
    });

    await updateProduct(id, {
      ...productInput(r, { name: "عود الإمارة الملكي" }),
      variants: [
        { id: small.id, sizeMl: 50, price: 55_000, initialStock: 999 },
        { sizeMl: 200, price: 150_000, initialStock: 7 },
      ],
    });
    const after = await ProductModel.findById(id).orFail();
    expect(after.variants.map((v) => [v.sizeMl, v.price, v.stockQuantity])).toEqual([
      [50, 55_000, 4],
      [200, 150_000, 7],
    ]);
    expect(after.searchText).toContain("الملكي");
    expect(await InventoryMovementModel.countDocuments({ productId: id })).toBe(2);
    // تنبيه الحجم المحذوف أُغلق
    expect(await NotificationModel.countDocuments({ isOpen: true })).toBe(0);
  });

  it("يقبل إعادة ترتيب الصور الموجودة ويرفض صورًا غير معروفة", async () => {
    const r = await refs();
    const { id } = await createProduct(productInput(r, { images: [testImage(1), testImage(2)] }));
    await updateProduct(id, productInput(r, { images: [testImage(2), testImage(1)] }));
    const product = await ProductModel.findById(id).orFail();
    const ordered = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(ordered.map((i) => i.publicId)).toEqual([testImage(2).publicId, testImage(1).publicId]);

    await expect(
      updateProduct(id, productInput(r, { images: [testImage(9)] })),
    ).rejects.toThrow(/صورة غير معروفة/);
  });

  it("النشر يتطلب صورة (P12)، والإيقاف يخفيه، والتمييز يعمل (P8)", async () => {
    const r = await refs();
    const { id } = await createProduct(productInput(r));
    await expect(setProductFlag(id, "isPublished", true)).rejects.toThrow(/صورة/);

    const withImage = await createProduct(productInput(r, { slug: "with-image", images: [testImage(3)] }));
    await setProductFlag(withImage.id, "isPublished", true);
    await setProductFlag(withImage.id, "isFeatured", true);
    expect(await ProductModel.findById(withImage.id).orFail()).toMatchObject({
      isPublished: true,
      isFeatured: true,
    });
    await setProductFlag(withImage.id, "isPublished", false);
    expect((await ProductModel.findById(withImage.id).orFail()).isPublished).toBe(false);
  });

  it("الحذف يبقي سجل الحركات ويغلق التنبيهات المفتوحة (P9)", async () => {
    const r = await refs();
    const { id } = await createProduct(productInput(r));
    const variant = (await getProductForEdit(id))?.variants[0];
    await NotificationModel.create({
      type: "low_stock",
      productId: id,
      variantId: variant?.id,
      productName: "عود",
      sizeMl: 50,
      quantityAtTrigger: 2,
      message: "منخفض",
    });
    await deleteProduct(id);
    expect(await ProductModel.exists({ _id: id })).toBeNull();
    expect(await InventoryMovementModel.countDocuments({ productId: id })).toBe(1);
    expect(await NotificationModel.countDocuments({ isOpen: true })).toBe(0);
    await expect(deleteProduct(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("قائمة الإدارة: بحث بالاسم المطبّع وبـSKU، وفلترة الحالة والمخزون", async () => {
    const r = await refs();
    await createProduct(productInput(r));
    await createProduct(
      productInput(r, {
        name: "مسك صافي",
        variants: [{ sizeMl: 30, sku: "MUSK-30", price: 1000, initialStock: 9 }],
      }),
    );
    expect((await listProductsForAdmin({ q: "الاماره", page: 1 })).items.map((i) => i.name)).toEqual([
      "عود الإمارة",
    ]);
    expect((await listProductsForAdmin({ q: "musk-30", page: 1 })).total).toBe(1);
    expect((await listProductsForAdmin({ status: "draft", page: 1 })).total).toBe(2);
    expect((await listProductsForAdmin({ status: "published", page: 1 })).total).toBe(0);
    // عود: 50ml=4 (≤ حد 3؟ لا) و100ml=0 → نافد
    expect((await listProductsForAdmin({ stock: "out", page: 1 })).items.map((i) => i.name)).toEqual([
      "عود الإمارة",
    ]);
    expect((await listProductsForAdmin({ stock: "low", page: 1 })).total).toBe(0);
  });
});

describe("إدارة التصنيفات والماركات", () => {
  it("تعديل اسم التصنيف يحدّث نص البحث للمنتجات، والحذف المرتبط مرفوض (P13)", async () => {
    const r = await refs();
    const { id } = await createProduct(productInput(r));
    await updateTaxonomy("category", r.categoryId, { name: "العود الكمبودي" });
    expect((await ProductModel.findById(id).orFail()).searchText).toContain("الكمبودي");

    await expect(deleteTaxonomy("category", r.categoryId)).rejects.toMatchObject({
      code: "CATEGORY_IN_USE",
    });
    const rows = await listTaxonomyForAdmin("category");
    expect(rows[0]).toMatchObject({ name: "العود الكمبودي", productCount: 1 });

    const free = await createTaxonomy("brand", { name: "ماركة حرة" });
    await deleteTaxonomy("brand", free.id);
    expect((await listTaxonomyForAdmin("brand")).map((b) => b.name)).toEqual(["دار العود"]);
  });
});

describe("إعدادات المتجر", () => {
  it("يحفظ رقم واتساب بصيغة wa.me والسياسات، ويرفض الروابط غير الآمنة", async () => {
    await updateSettings({
      storeName: "عطور عبق الخليج",
      whatsappNumber: "010 1234 5678",
      policies: [{ slug: "shipping", title: "الشحن", body: "نوصل لكل المحافظات خلال أيام." }],
    });
    const stored = await StoreSettingsModel.findById("store").orFail();
    expect(stored.whatsappNumber).toBe("201012345678");
    expect((await getSettingsForEdit()).whatsappLocal).toBe("01012345678");
    expect(stored.policies.map((p) => p.slug)).toEqual(["shipping"]);

    await expect(
      updateSettings({ storeName: "متجر", socialLinks: { instagram: "javascript:alert(1)" } }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("لوحة التحكم", () => {
  it("إحصائيات من البيانات الفعلية فقط", async () => {
    const r = await refs();
    await createProduct(productInput(r));
    await createProduct(
      productInput(r, {
        slug: "published-one",
        images: [testImage(5)],
        isPublished: true,
        isFeatured: true,
        variants: [{ sizeMl: 50, price: 100, initialStock: 2, lowStockThreshold: 3 }],
      }),
    );
    const stats = await getDashboardStats();
    expect(stats.products).toEqual({ total: 2, published: 1, draft: 1, featured: 1, onSale: 1 });
    expect(stats.stock).toEqual({ lowVariants: 1, outVariants: 1 });
    expect(stats.recentMovements).toHaveLength(2);
    expect(stats).not.toHaveProperty("sales");
  });
});
