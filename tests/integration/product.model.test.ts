import { describe, expect, it } from "vitest";
import { isDuplicateKeyError, toAppError } from "@/lib/errors";
import { ProductModel } from "@/models/product";
import { trusted } from "@/models/_mongoose";
import { createRefs, productData, testImage } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("product-model");

async function expectValidationError(promise: Promise<unknown>, path: string, text?: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  const appError = toAppError(error);
  expect(appError.code, `توقعنا خطأ تحقق على ${path}`).toBe("VALIDATION");
  expect(Object.keys(appError.fieldErrors ?? {})).toContain(path);
  if (text) expect(appError.fieldErrors?.[path]?.join()).toContain(text);
}

describe("Product model", () => {
  it("ينشئ منتجًا صحيحًا ويحسب الحقول المشتقة (P1)", async () => {
    const refs = await createRefs();
    const product = await ProductModel.create(
      productData(refs, {
        name: "إطلالة العود",
        variants: [
          { sizeMl: 50, price: 50_000, compareAtPrice: 60_000, stockQuantity: 0 },
          { sizeMl: 100, price: 90_000, stockQuantity: 4 },
          { sizeMl: 30, price: 20_000, stockQuantity: 9, isAvailable: false },
        ],
      }),
    );
    expect(product.minPrice).toBe(50_000); // أقل سعر بين الأحجام المتاحة فقط
    expect(product.inStock).toBe(true);
    expect(product.isOnSale).toBe(true);
    expect(product.searchText).toBe("اطلاله العود");
    expect(product.createdAt).toBeInstanceOf(Date);
    expect(product.variants.every((variant) => variant._id)).toBe(true);
  });

  it("hideFromOffers يخفي المنتج من العروض رغم وجود خصم", async () => {
    const refs = await createRefs();
    const product = await ProductModel.create(
      productData(refs, {
        hideFromOffers: true,
        variants: [{ sizeMl: 50, price: 100, compareAtPrice: 200, stockQuantity: 1 }],
      }),
    );
    expect(product.isOnSale).toBe(false);
  });

  it("يرفض البيانات الناقصة (P2)", async () => {
    await expectValidationError(ProductModel.create({ variants: [] }), "name", "مطلوب");
    const refs = await createRefs();
    await expectValidationError(
      ProductModel.create(productData(refs, { variants: [] })),
      "variants",
      "أحجام",
    );
    const { categoryId: _omit, ...withoutCategory } = productData(refs);
    await expectValidationError(ProductModel.create(withoutCategory), "categoryId", "التصنيف");
  });

  it.each([
    [-5, "أكبر من صفر"],
    [0, "أكبر من صفر"],
    [99.5, "عددًا صحيحًا"],
  ])("يرفض السعر %s (P3)", async (price, message) => {
    const refs = await createRefs();
    await expectValidationError(
      ProductModel.create(productData(refs, { variants: [{ sizeMl: 50, price, stockQuantity: 1 }] })),
      "variants.0.price",
      message,
    );
  });

  it("يرفض خصمًا غير منطقي (P4)", async () => {
    const refs = await createRefs();
    await expectValidationError(
      ProductModel.create(
        productData(refs, {
          variants: [{ sizeMl: 50, price: 500, compareAtPrice: 500, stockQuantity: 1 }],
        }),
      ),
      "variants.0.compareAtPrice",
      "أكبر من السعر الحالي",
    );
  });

  it("يرفض Slug مكررًا برسالة عربية (P5)", async () => {
    const refs = await createRefs();
    await ProductModel.create(productData(refs, { slug: "عود-ملكي" }));
    const error = await ProductModel.create(productData(refs, { slug: "عود-ملكي" })).catch(
      (caught: unknown) => caught,
    );
    expect(isDuplicateKeyError(error)).toBe(true);
    expect(toAppError(error).message).toContain("الرابط (slug) مستخدم بالفعل");
  });

  it("يرفض SKU مكررًا بين منتجين وداخل نفس المنتج (P6)", async () => {
    const refs = await createRefs();
    await ProductModel.create(
      productData(refs, { variants: [{ sizeMl: 50, sku: "OUD-50", price: 100, stockQuantity: 1 }] }),
    );
    const crossProduct = await ProductModel.create(
      productData(refs, { variants: [{ sizeMl: 50, sku: "oud-50", price: 100, stockQuantity: 1 }] }),
    ).catch((caught: unknown) => caught);
    expect(toAppError(crossProduct).message).toContain("SKU");

    await expectValidationError(
      ProductModel.create(
        productData(refs, {
          variants: [
            { sizeMl: 50, sku: "ROSE-1", price: 100, stockQuantity: 1 },
            { sizeMl: 100, sku: "ROSE-1", price: 200, stockQuantity: 1 },
          ],
        }),
      ),
      "variants.1.sku",
      "مكرر",
    );
  });

  it("يسمح بعدة منتجات بلا SKU (فهرس جزئي)", async () => {
    const refs = await createRefs();
    const noSku = { variants: [{ sizeMl: 50, price: 100, stockQuantity: 1 }] };
    await ProductModel.create(productData(refs, noSku));
    await expect(ProductModel.create(productData(refs, noSku))).resolves.toBeDefined();
  });

  it("يرفض حجمًا مكررًا وكمية سالبة", async () => {
    const refs = await createRefs();
    await expectValidationError(
      ProductModel.create(
        productData(refs, {
          variants: [
            { sizeMl: 50, price: 100, stockQuantity: 1 },
            { sizeMl: 50, price: 200, stockQuantity: 1 },
          ],
        }),
      ),
      "variants.1.sizeMl",
      "مكرر",
    );
    await expectValidationError(
      ProductModel.create(
        productData(refs, { variants: [{ sizeMl: 50, price: 100, stockQuantity: -1 }] }),
      ),
      "variants.0.stockQuantity",
      "سالبة",
    );
  });

  it("يمنع النشر بدون صورة أو بدون حجم متاح (P12)", async () => {
    const refs = await createRefs();
    await expectValidationError(
      ProductModel.create(productData(refs, { isPublished: true, images: [] })),
      "isPublished",
      "صورة",
    );
    await expectValidationError(
      ProductModel.create(
        productData(refs, {
          isPublished: true,
          variants: [{ sizeMl: 50, price: 100, stockQuantity: 5, isAvailable: false }],
        }),
      ),
      "isPublished",
      "حجم متاح",
    );
  });

  it("يرفض صورًا من خارج Cloudinary وأكثر من 12 صورة", async () => {
    const refs = await createRefs();
    await expectValidationError(
      ProductModel.create(
        productData(refs, { images: [{ ...testImage(0), secureUrl: "http://evil.example/x.jpg" }] }),
      ),
      "images.0.secureUrl",
    );
    await expectValidationError(
      ProductModel.create(
        productData(refs, { images: Array.from({ length: 13 }, (_, i) => testImage(i)) }),
      ),
      "images",
      "12",
    );
  });

  it("لكل حجم سعر ومخزون مستقلان (P10 — مستوى البيانات)", async () => {
    const refs = await createRefs();
    const product = await ProductModel.create(productData(refs));
    const [small, large] = product.variants;
    if (!small || !large) throw new Error("factory");

    await ProductModel.updateOne(
      { _id: product._id },
      { $inc: { "variants.$[v].stockQuantity": -3 } },
      { arrayFilters: [{ "v._id": small._id }] },
    );
    const reloaded = await ProductModel.findById(product._id).orFail();
    const variantById = (id: typeof small._id) => reloaded.variants.find((v) => v._id.equals(id));
    expect(variantById(small._id)?.stockQuantity).toBe(small.stockQuantity - 3);
    expect(variantById(large._id)?.stockQuantity).toBe(large.stockQuantity);
    expect(variantById(large._id)?.price).toBe(large.price);
  });

  it("sanitizeFilter يعامل مشغّلات المستخدم كقيم حرفية (حماية NoSQL injection)", async () => {
    const refs = await createRefs();
    await ProductModel.create(productData(refs, { isPublished: false }));
    // المشغّل يُغلَّف بـ $eq ويُعامل كقيمة نصية، فيُرفض الاستعلام بدل أن يُطابق كل المنتجات.
    const attackerInput: unknown = { $ne: "x" };
    await expect(ProductModel.find({ slug: attackerInput as string })).rejects.toThrow(/Cast to string/);
    const legit = await ProductModel.find({ slug: trusted({ $ne: "x" }) });
    expect(legit).toHaveLength(1);
  });

  it("الفهارس الموثقة موجودة", async () => {
    const indexes = (await ProductModel.listIndexes()) as Array<{ key: Record<string, unknown> }>;
    const keys = indexes.map((index) => Object.keys(index.key).join(","));
    expect(keys).toEqual(
      expect.arrayContaining([
        "slug",
        "variants.sku",
        "isPublished,categoryId,sortOrder,createdAt",
        "isPublished,brandId,createdAt",
        "isPublished,isFeatured,sortOrder",
        "isPublished,isOnSale",
        "isPublished,minPrice",
        "isPublished,searchText",
        "images.publicId",
      ]),
    );
  });
});
