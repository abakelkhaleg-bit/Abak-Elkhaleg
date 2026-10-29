import { describe, expect, it } from "vitest";
import { poundsInputSchema, withSlugFallback } from "@/schemas/common";
import { stockOperationSchema } from "@/schemas/inventory";
import { createOrderInputSchema } from "@/schemas/order";
import { productInputSchema } from "@/schemas/product";
import { storeSettingsInputSchema } from "@/schemas/settings";
import { categoryInputSchema } from "@/schemas/taxonomy";

const ids = {
  categoryId: "65f0a1b2c3d4e5f6a7b8c9d0",
  brandId: "65f0a1b2c3d4e5f6a7b8c9d1",
  productId: "65f0a1b2c3d4e5f6a7b8c9d2",
  variantId: "65f0a1b2c3d4e5f6a7b8c9d3",
};

const image = {
  secureUrl: "https://res.cloudinary.com/x/image/upload/abak-elkhalig/products/a.jpg",
  publicId: "abak-elkhalig/products/a",
};

type VariantDraft = {
  sizeMl: number;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  initialStock?: number;
  isAvailable?: boolean;
};

const validProduct = () => ({
  name: "عود ملكي",
  shortDescription: "عود فاخر",
  categoryId: ids.categoryId,
  brandId: ids.brandId,
  images: [image],
  variants: <VariantDraft[]>[
    { sizeMl: 50, sku: "oud-50", price: 95_000, compareAtPrice: 120_000, initialStock: 5 },
    { sizeMl: 100, price: 165_000 },
  ],
});

function issuesOf(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  return (result.error?.issues ?? []).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("productInputSchema", () => {
  it("يقبل منتجًا صحيحًا ويطبّع SKU والقيم الافتراضية (P1)", () => {
    const parsed = productInputSchema.parse(validProduct());
    expect(parsed.variants[0]?.sku).toBe("OUD-50");
    expect(parsed.variants[1]?.isAvailable).toBe(true);
    expect(parsed.variants[1]?.lowStockThreshold).toBe(3);
    expect(parsed.isPublished).toBe(false);
  });

  it("يرفض البيانات الناقصة (P2)", () => {
    const result = productInputSchema.safeParse({ variants: [] });
    const messages = issuesOf(result).join("\n");
    expect(result.success).toBe(false);
    expect(messages).toContain("name");
    expect(messages).toContain("categoryId");
    expect(messages).toContain("أضف حجمًا واحدًا على الأقل");
  });

  it.each([-100, 0, 12.5])("يرفض سعرًا غير صالح %s (P3)", (price) => {
    const data = validProduct();
    data.variants[1] = { sizeMl: 100, price };
    expect(productInputSchema.safeParse(data).success).toBe(false);
  });

  it.each([95_000, 90_000])("يرفض خصمًا غير منطقي compareAtPrice=%i (P4)", (compareAtPrice) => {
    const data = validProduct();
    data.variants[0] = { sizeMl: 50, price: 95_000, compareAtPrice };
    const result = productInputSchema.safeParse(data);
    expect(result.success).toBe(false);
    expect(issuesOf(result).join()).toContain("السعر قبل الخصم");
  });

  it("يرفض حجمًا أو SKU مكررًا داخل نفس العطر", () => {
    const data = validProduct();
    data.variants[1] = { sizeMl: 50, sku: "OUD-50", price: 1000 };
    const messages = issuesOf(productInputSchema.safeParse(data)).join("\n");
    expect(messages).toContain("هذا الحجم مكرر");
    expect(messages).toContain("رمز SKU مكرر");
  });

  it("يرفض النشر بدون صورة أو بدون حجم متاح (P12)", () => {
    const noImage = { ...validProduct(), images: [], isPublished: true };
    expect(issuesOf(productInputSchema.safeParse(noImage)).join()).toContain("بدون صورة");

    const noneAvailable = validProduct();
    const unavailable = {
      ...noneAvailable,
      isPublished: true,
      variants: noneAvailable.variants.map((variant) => ({ ...variant, isAvailable: false })),
    };
    expect(issuesOf(productInputSchema.safeParse(unavailable)).join()).toContain("بدون حجم متاح");
  });

  it("يرفض صورًا من خارج Cloudinary", () => {
    const data = { ...validProduct(), images: [{ ...image, secureUrl: "http://evil.example/a.jpg" }] };
    expect(productInputSchema.safeParse(data).success).toBe(false);
  });
});

describe("poundsInputSchema / withSlugFallback", () => {
  it("يحوّل الجنيه إلى قروش ويرفض الصيغ الخاطئة", () => {
    expect(poundsInputSchema.parse("125.50")).toBe(12_550);
    expect(poundsInputSchema.safeParse("12.345").success).toBe(false);
    expect(poundsInputSchema.safeParse("-1").success).toBe(false);
  });

  it("يقترح slug من الاسم عند تركه فارغًا", () => {
    const parsed = categoryInputSchema.parse({ name: "العطور الشرقية" });
    expect(withSlugFallback(parsed).slug).toBe("العطور-الشرقية");
    expect(withSlugFallback({ ...parsed, slug: "oriental" }).slug).toBe("oriental");
  });
});

describe("createOrderInputSchema", () => {
  const validOrder = () => ({
    items: [{ productId: ids.productId, variantId: ids.variantId, quantity: 2 }],
    customer: { name: "أحمد", phone: "+20 101 234 5678", governorate: "cairo" },
  });

  it("يحذف أي سعر أو إجمالي يرسله المتصفح (W1)", () => {
    const tampered = {
      ...validOrder(),
      total: 1,
      items: [{ ...validOrder().items[0], price: 1, unitPrice: 1 }],
    };
    const parsed = createOrderInputSchema.parse(tampered);
    expect(parsed).not.toHaveProperty("total");
    expect(parsed.items[0]).toEqual({ productId: ids.productId, variantId: ids.variantId, quantity: 2 });
  });

  it("يطبّع رقم الهاتف المصري (W12)", () => {
    expect(createOrderInputSchema.parse(validOrder()).customer.phone).toBe("01012345678");
  });

  it.each([0, -1, 1.5, 21])("يرفض كمية غير صالحة %s (W2)", (quantity) => {
    const data = validOrder();
    data.items = [{ ...data.items[0]!, quantity }];
    expect(createOrderInputSchema.safeParse(data).success).toBe(false);
  });

  it("يرفض هاتفًا ومحافظة غير صالحين (W12)", () => {
    const data = { ...validOrder(), customer: { name: "أحمد", phone: "0123", governorate: "dubai" } };
    const messages = issuesOf(createOrderInputSchema.safeParse(data)).join("\n");
    expect(messages).toContain("رقم موبايل مصري");
    expect(messages).toContain("اختر المحافظة");
  });

  it("يرفض نفس الحجم مكررًا في السلة", () => {
    const data = validOrder();
    data.items = [data.items[0]!, data.items[0]!];
    expect(createOrderInputSchema.safeParse(data).success).toBe(false);
  });

  it("يرفض معرّفات غير صالحة (W4)", () => {
    const data = validOrder();
    data.items = [{ productId: "x", variantId: "{$ne:1}", quantity: 1 }];
    expect(createOrderInputSchema.safeParse(data).success).toBe(false);
  });
});

describe("stockOperationSchema", () => {
  const target = { productId: ids.productId, variantId: ids.variantId };

  it("يقبل العمليات الثلاث بالشروط الصحيحة", () => {
    expect(stockOperationSchema.safeParse({ type: "restock", ...target, quantity: 5 }).success).toBe(true);
    expect(
      stockOperationSchema.safeParse({ type: "adjustment", ...target, delta: -2, reason: "عبوة تالفة" })
        .success,
    ).toBe(true);
    expect(
      stockOperationSchema.safeParse({ type: "stocktake", ...target, newQuantity: 0, reason: "جرد شهري" })
        .success,
    ).toBe(true);
  });

  it("يرفض توريد صفر أو تعديل بدون سبب أو جرد بكمية سالبة (S3)", () => {
    expect(stockOperationSchema.safeParse({ type: "restock", ...target, quantity: 0 }).success).toBe(false);
    expect(stockOperationSchema.safeParse({ type: "adjustment", ...target, delta: -2 }).success).toBe(false);
    expect(stockOperationSchema.safeParse({ type: "adjustment", ...target, delta: 0, reason: "سبب" }).success).toBe(false);
    expect(
      stockOperationSchema.safeParse({ type: "stocktake", ...target, newQuantity: -1, reason: "جرد" }).success,
    ).toBe(false);
  });
});

describe("storeSettingsInputSchema", () => {
  it("يحوّل رقم واتساب المصري إلى صيغة wa.me ويقبل الحقول الفارغة", () => {
    const parsed = storeSettingsInputSchema.parse({ storeName: "عطور عبق الخليج", whatsappNumber: "01012345678" });
    expect(parsed.whatsappNumber).toBe("201012345678");
    expect(parsed.socialLinks).toEqual({
      instagram: undefined,
      facebook: undefined,
      tiktok: undefined,
      x: undefined,
      snapchat: undefined,
    });
  });

  it("يرفض روابط تواصل غير https ورقم واتساب غير صالح", () => {
    const result = storeSettingsInputSchema.safeParse({
      storeName: "متجر",
      whatsappNumber: "123",
      socialLinks: { instagram: "javascript:alert(1)" },
    });
    const messages = issuesOf(result).join("\n");
    expect(messages).toContain("رقم واتساب");
    expect(messages).toContain("https://");
  });
});
