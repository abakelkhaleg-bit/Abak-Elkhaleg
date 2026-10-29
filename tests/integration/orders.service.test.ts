import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { OrderRequestModel } from "@/models/order-request";
import { ProductModel } from "@/models/product";
import { loadStoreSettings } from "@/models/store-settings";
import { createRefs, productData } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

/** W1–W4، W9، W11، S4، S6، S7، S13 (docs/TESTING.md) على الخدمة الحقيقية. */

vi.hoisted(() => {
  process.env.IP_HASH_SALT = "s".repeat(40);
  process.env.CRON_SECRET = "c".repeat(40);
});

const {
  cancelOrder,
  confirmOrder,
  createOrderRequest,
  displayStatus,
  listOrders,
  purgeOrderPii,
  purgePiiOlderThan,
} = await import("@/server/orders.service");

setupTestDatabase("orders-service");

const customer = { name: "سارة أحمد", phone: "01012345678", governorate: "cairo", notes: "بعد العصر" };
let ipCounter = 0;
const ctx = () => ({ ip: `198.51.100.${(ipCounter += 1)}` });

async function setWhatsApp(number: string | undefined) {
  const settings = await loadStoreSettings();
  settings.set("whatsappNumber", number);
  await settings.save();
}

async function publishedProduct(overrides: Parameters<typeof productData>[1] = {}) {
  const refs = await createRefs();
  const product = await ProductModel.create(
    productData(refs, {
      isPublished: true,
      variants: [
        { sizeMl: 50, price: 33_333, stockQuantity: 5, lowStockThreshold: 1 },
        { sizeMl: 100, price: 45_050, stockQuantity: 2, lowStockThreshold: 1 },
      ],
      ...overrides,
    }),
  );
  const [v50, v100] = product.variants;
  if (!v50 || !v100) throw new Error("variants");
  return { productId: product._id.toString(), v50: v50._id.toString(), v100: v100._id.toString() };
}

const stocks = async (productId: string) =>
  (await ProductModel.findById(productId).orFail()).variants.map((v) => v.stockQuantity);

beforeEach(async () => {
  // الإعدادات تخزن الرقم بالصيغة الدولية (WHATSAPP_E164_PATTERN).
  await setWhatsApp("201098765432");
});

describe("إنشاء الطلب", () => {
  it("يحفظ طلبًا برقم مرجعي فريد وحالة opened_in_whatsapp ولا يغير المخزون (W9، S6)", async () => {
    const p = await publishedProduct();
    const a = await createOrderRequest(
      { items: [{ productId: p.productId, variantId: p.v50, quantity: 3 }], customer },
      ctx(),
    );
    const b = await createOrderRequest(
      { items: [{ productId: p.productId, variantId: p.v100, quantity: 1 }], customer },
      ctx(),
    );
    expect(a.reference).toMatch(/^AK-\d{6}$/);
    expect(b.reference).not.toBe(a.reference);
    const saved = await OrderRequestModel.findOne({ reference: a.reference }).orFail();
    expect(saved.status).toBe("opened_in_whatsapp");
    expect(saved.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await stocks(p.productId)).toEqual([5, 2]);
    expect(await InventoryMovementModel.countDocuments({ orderId: saved._id })).toBe(0);
    expect(a.whatsappUrl).toMatch(/^https:\/\/wa\.me\/201098765432\?text=/);
    expect(new URL(a.whatsappUrl).searchParams.get("text")).toContain(a.reference);
  });

  it("يتجاهل السعر والإجمالي من العميل ويستخدم أسعار القاعدة (W1، W5)", async () => {
    const p = await publishedProduct();
    const result = await createOrderRequest(
      {
        items: [
          { productId: p.productId, variantId: p.v50, quantity: 3, price: 1, lineTotal: 3 },
          { productId: p.productId, variantId: p.v100, quantity: 1, price: 1 },
        ],
        customer,
        total: 4,
      },
      ctx(),
    );
    expect(result.total).toBe(33_333 * 3 + 45_050);
    const saved = await OrderRequestModel.findOne({ reference: result.reference }).orFail();
    expect(saved.items.map((i) => [i.unitPrice, i.lineTotal])).toEqual([
      [33_333, 99_999],
      [45_050, 45_050],
    ]);
  });

  it("يرفض كمية أكبر من المتاح أو ≤ 0 أو غير صحيحة (W2)", async () => {
    const p = await publishedProduct();
    const item = (quantity: unknown) => ({
      items: [{ productId: p.productId, variantId: p.v100, quantity }],
      customer,
    });
    await expect(createOrderRequest(item(3), ctx())).rejects.toMatchObject({ code: "CART_CHANGED" });
    for (const bad of [0, -1, 1.5, "2"]) {
      await expect(createOrderRequest(item(bad), ctx())).rejects.toMatchObject({ code: "VALIDATION" });
    }
    expect(await OrderRequestModel.countDocuments()).toBe(0);
  });

  it("يرفض منتجًا غير منشور (W3) وحجمًا غير تابع للمنتج (W4)", async () => {
    const draft = await publishedProduct({ isPublished: false });
    const other = await publishedProduct();
    await expect(
      createOrderRequest({ items: [{ productId: draft.productId, variantId: draft.v50, quantity: 1 }], customer }, ctx()),
    ).rejects.toMatchObject({ code: "CART_CHANGED" });
    await expect(
      createOrderRequest({ items: [{ productId: other.productId, variantId: draft.v50, quantity: 1 }], customer }, ctx()),
    ).rejects.toMatchObject({ code: "CART_CHANGED" });
    await expect(
      createOrderRequest({ items: [{ productId: other.productId, variantId: "f".repeat(24), quantity: 1 }], customer }, ctx()),
    ).rejects.toMatchObject({ code: "CART_CHANGED" });
    expect(await OrderRequestModel.countDocuments()).toBe(0);
  });

  it("يرفض الطلب برسالة واضحة إن لم يُضبط رقم واتساب (W10 — الخادم)", async () => {
    await setWhatsApp(undefined);
    const p = await publishedProduct();
    await expect(
      createOrderRequest({ items: [{ productId: p.productId, variantId: p.v50, quantity: 1 }], customer }, ctx()),
    ).rejects.toMatchObject({ code: "WHATSAPP_NOT_CONFIGURED" });
  });

  it("يطبق rate limit على إنشاء الطلبات لكل IP (W11)", async () => {
    const p = await publishedProduct();
    const input = { items: [{ productId: p.productId, variantId: p.v50, quantity: 1 }], customer };
    const fixed = { ip: "203.0.113.50" };
    for (let i = 0; i < 10; i += 1) await createOrderRequest(input, fixed);
    await expect(createOrderRequest(input, fixed)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(createOrderRequest(input, { ip: "203.0.113.51" })).resolves.toBeTruthy();
  });
});

describe("تأكيد وإلغاء الطلب", () => {
  async function openOrder(p: Awaited<ReturnType<typeof publishedProduct>>, q50: number, q100: number) {
    const { reference } = await createOrderRequest(
      {
        items: [
          { productId: p.productId, variantId: p.v50, quantity: q50 },
          { productId: p.productId, variantId: p.v100, quantity: q100 },
        ],
        customer,
      },
      ctx(),
    );
    return (await OrderRequestModel.findOne({ reference }).orFail())._id.toString();
  }

  it("التأكيد يخصم كل البنود بحركات sale مرتبطة بالطلب", async () => {
    const p = await publishedProduct();
    const id = await openOrder(p, 2, 1);
    await confirmOrder(id);
    expect(await stocks(p.productId)).toEqual([3, 1]);
    const order = await OrderRequestModel.findById(id).orFail();
    expect(order.status).toBe("confirmed");
    expect(order.statusHistory.map((h) => h.status)).toEqual(["opened_in_whatsapp", "confirmed"]);
    expect(await InventoryMovementModel.countDocuments({ orderId: id, movementType: "sale" })).toBe(2);
  });

  it("تأكيد بكمية أكبر من المخزون يُرفض ولا يتغير أي شيء (S4)", async () => {
    const p = await publishedProduct();
    const id = await openOrder(p, 2, 2);
    await ProductModel.updateOne({ _id: p.productId }, { $set: { "variants.1.stockQuantity": 1 } });
    await expect(confirmOrder(id)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await stocks(p.productId)).toEqual([5, 1]);
    expect((await OrderRequestModel.findById(id).orFail()).status).toBe("opened_in_whatsapp");
    expect(await InventoryMovementModel.countDocuments({ orderId: id })).toBe(0);
  });

  it("تأكيد نفس الطلب مرتين أو بالتوازي يخصم مرة واحدة (S7)", async () => {
    const p = await publishedProduct();
    const id = await openOrder(p, 1, 1);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => confirmOrder(id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(confirmOrder(id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await stocks(p.productId)).toEqual([4, 1]);
    expect(await InventoryMovementModel.countDocuments({ orderId: id, movementType: "sale" })).toBe(2);
  });

  it("إلغاء طلب مؤكد يعيد المخزون بحركة order_cancel_restore (S13)، والمفتوح لا يلمس المخزون", async () => {
    const p = await publishedProduct();
    const confirmed = await openOrder(p, 2, 1);
    await confirmOrder(confirmed);
    await cancelOrder(confirmed);
    expect(await stocks(p.productId)).toEqual([5, 2]);
    expect(
      await InventoryMovementModel.countDocuments({ orderId: confirmed, movementType: "order_cancel_restore" }),
    ).toBe(2);
    await expect(cancelOrder(confirmed)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(confirmOrder(confirmed)).rejects.toMatchObject({ code: "CONFLICT" });

    const open = await openOrder(p, 1, 1);
    await cancelOrder(open);
    expect(await stocks(p.productId)).toEqual([5, 2]);
    expect(await InventoryMovementModel.countDocuments({ orderId: open })).toBe(0);
  });

  it("الطلب المفتوح الأقدم من 7 أيام يظهر «منتهي» ويبقى قابلًا للتأكيد", async () => {
    const p = await publishedProduct();
    const id = await openOrder(p, 1, 1);
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const doc = await OrderRequestModel.findById(id).orFail();
    await OrderRequestModel.collection.updateOne({ _id: doc._id }, { $set: { createdAt: old } });
    const order = await OrderRequestModel.findById(id).orFail();
    expect(displayStatus(order)).toBe("expired");
    expect((await listOrders({ filter: "expired", page: 1 })).items.map((o) => o.id)).toEqual([id]);
    expect((await listOrders({ filter: "open", page: 1 })).items).toHaveLength(0);
    await confirmOrder(id);
    expect((await OrderRequestModel.findById(id).orFail()).status).toBe("confirmed");
  });
});

describe("البيانات الشخصية", () => {
  it("حذف PII يفرغ بيانات العميل ويبقي البنود والإجمالي", async () => {
    const p = await publishedProduct();
    const { reference } = await createOrderRequest(
      { items: [{ productId: p.productId, variantId: p.v50, quantity: 1 }], customer },
      ctx(),
    );
    const order = await OrderRequestModel.findOne({ reference }).orFail();
    await purgeOrderPii(order._id.toString());
    const after = await OrderRequestModel.findById(order._id).lean().orFail();
    expect(after.customer ?? {}).toEqual({});
    expect(after.ipHash).toBeUndefined();
    expect(after.piiPurgedAt).toBeInstanceOf(Date);
    expect(after.total).toBe(33_333);
    expect(after.items).toHaveLength(1);
  });

  it("الحذف الجماعي يشمل الطلبات الأقدم من المدة فقط", async () => {
    const p = await publishedProduct();
    const input = { items: [{ productId: p.productId, variantId: p.v50, quantity: 1 }], customer };
    const oldRef = (await createOrderRequest(input, ctx())).reference;
    const newRef = (await createOrderRequest(input, ctx())).reference;
    await OrderRequestModel.collection.updateOne(
      { reference: oldRef },
      { $set: { createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) } },
    );
    expect(await purgePiiOlderThan(180)).toBe(1);
    expect((await OrderRequestModel.findOne({ reference: oldRef }).orFail()).piiPurgedAt).toBeInstanceOf(Date);
    expect((await OrderRequestModel.findOne({ reference: newRef }).orFail()).customer?.name).toBe("سارة أحمد");
  });
});
