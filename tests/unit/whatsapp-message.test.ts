import { describe, expect, it } from "vitest";
import { multiplyPiasters } from "@/lib/money";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp-message";
import { createOrderInputSchema } from "@/schemas/order";

const order = {
  reference: "AK-000042",
  storeName: "عطور عبق الخليج",
  items: [
    { productName: "عود & مسك؟ #1", sizeMl: 50, quantity: 3, unitPrice: 33_333, lineTotal: multiplyPiasters(33_333, 3) },
    { productName: "إطلالة", sizeMl: 100, quantity: 1, unitPrice: 45_050, lineTotal: 45_050 },
  ],
  total: multiplyPiasters(33_333, 3) + 45_050,
  customer: {
    name: "سارة أحمد",
    phone: "01012345678",
    governorate: "alexandria",
    address: "شارع ١٥، سموحة\nالدور الثالث",
    notes: "اتصل قبل التوصيل 😊",
  },
};

describe("رسالة واتساب", () => {
  it("تحسب الإجمالي بدقة بالقروش لعدة بنود وأسعار بكسور (W5)", () => {
    expect(order.items[0]?.lineTotal).toBe(99_999);
    expect(order.total).toBe(145_049);
    expect(buildOrderMessage(order)).toMatch(/الإجمالي: .*١[٬,]?٤٥٠[٫.]٤٩/);
  });

  it("تحتوي الرقم المرجعي والبنود وبيانات العميل والملاحظات", () => {
    const message = buildOrderMessage(order);
    for (const part of ["AK-000042", "عود & مسك؟ #1", "إطلالة", "سارة أحمد", "01012345678", "الإسكندرية", "سموحة", "اتصل قبل التوصيل"]) {
      expect(message).toContain(part);
    }
    expect(message).not.toContain("alexandria");
  });

  it("فك ترميز الرابط يعيد النص حرفيًا مع الأسطر الجديدة والرموز (W6)", () => {
    const message = buildOrderMessage(order);
    const url = new URL(buildWhatsAppUrl("01098765432", message));
    expect(url.searchParams.get("text")).toBe(message);
    expect(decodeURIComponent(url.search.slice("?text=".length))).toBe(message);
    expect(message.split("\n").length).toBeGreaterThan(8);
    // & و# والمسافات والأسطر الجديدة مرمّزة، فلا تقطع الرابط.
    expect(url.search.slice(1)).not.toMatch(/[\s#]|&(?!$)/);
  });

  it("يستخدم رقم المتجر بصيغة wa.me/20… (W7)", () => {
    expect(buildWhatsAppUrl("01098765432", "x")).toBe("https://wa.me/201098765432?text=x");
    expect(buildWhatsAppUrl("+20 109 876 5432", "x")).toMatch(/^https:\/\/wa\.me\/201098765432\?/);
    expect(() => buildWhatsAppUrl("12345", "x")).toThrow();
  });
});

describe("مدخلات الطلب (W12)", () => {
  const item = { productId: "a".repeat(24), variantId: "b".repeat(24), quantity: 1 };
  const customer = { name: "سارة", phone: "01012345678", governorate: "cairo" };

  it("يرفض هاتفًا مصريًا غير صالح ويقبل الصيغ الشائعة", () => {
    for (const phone of ["0101234567", "01312345678", "1234", "+441012345678"]) {
      expect(createOrderInputSchema.safeParse({ items: [item], customer: { ...customer, phone } }).success).toBe(false);
    }
    const parsed = createOrderInputSchema.parse({ items: [item], customer: { ...customer, phone: "+20 101 234 5678" } });
    expect(parsed.customer.phone).toBe("01012345678");
  });

  it("يرفض محافظة غير موجودة", () => {
    const result = createOrderInputSchema.safeParse({ items: [item], customer: { ...customer, governorate: "dubai" } });
    expect(result.success).toBe(false);
  });

  it("يحذف أي سعر أو إجمالي يرسله العميل (W1 — طبقة المدخلات)", () => {
    const parsed = createOrderInputSchema.parse({
      items: [{ ...item, price: 1, lineTotal: 1 }],
      customer,
      total: 1,
    });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed.items[0]).not.toHaveProperty("price");
  });
});
