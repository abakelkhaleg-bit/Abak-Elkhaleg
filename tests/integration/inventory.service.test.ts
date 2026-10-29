import { describe, expect, it } from "vitest";
import { toAppError } from "@/lib/errors";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { NotificationModel } from "@/models/notification";
import { mongoose } from "@/models/_mongoose";
import { ProductModel } from "@/models/product";
import { getDashboardStats } from "@/server/admin/dashboard.service";
import {
  applyStockOperation,
  changeVariantStock,
  listInventory,
  listMovements,
  setLowStockThreshold,
} from "@/server/inventory.service";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/notifications.service";
import { createRefs, productData } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

/** S1–S3 وS8–S12 (docs/TESTING.md) على الخدمة الحقيقية داخل معاملات replica set. */

setupTestDatabase("inventory-service");

async function variantWith(stockQuantity: number, lowStockThreshold = 3) {
  const refs = await createRefs();
  const product = await ProductModel.create(
    productData(refs, {
      variants: [{ sizeMl: 50, price: 50_000, stockQuantity, lowStockThreshold }],
    }),
  );
  const variant = product.variants[0];
  if (!variant) throw new Error("no variant");
  return { productId: product._id.toString(), variantId: variant._id.toString() };
}

const stockOf = async (t: { productId: string; variantId: string }) =>
  (await ProductModel.findById(t.productId).orFail()).variants.find(
    (v) => v._id.toString() === t.variantId,
  )?.stockQuantity;

const openNotifications = (variantId: string, type?: "low_stock" | "out_of_stock") =>
  NotificationModel.find(type ? { variantId, isOpen: true, type } : { variantId, isOpen: true });

describe("عمليات المخزون اليدوية", () => {
  it("كل تعديل يدوي يسجل حركة بالقيم السابقة والجديدة والسبب والتاريخ (S9)", async () => {
    const t = await variantWith(10);
    await applyStockOperation({ type: "restock", ...t, quantity: 5 });
    await applyStockOperation({ type: "adjustment", ...t, delta: -2, reason: "زجاجة مكسورة" });
    await applyStockOperation({ type: "stocktake", ...t, newQuantity: 11, reason: "جرد نهاية الشهر" });

    const movements = await InventoryMovementModel.find({ variantId: t.variantId }).sort({ _id: 1 });
    expect(
      movements.map((m) => [m.movementType, m.previousQuantity, m.newQuantity, m.quantityDelta, m.reason ?? null]),
    ).toEqual([
      ["restock", 10, 15, 5, null],
      ["adjustment", 15, 13, -2, "زجاجة مكسورة"],
      ["stocktake", 13, 11, -2, "جرد نهاية الشهر"],
    ]);
    expect(movements.every((m) => m.createdAt instanceof Date)).toBe(true);
    expect(await stockOf(t)).toBe(11);

    const log = await listMovements({ productId: t.productId, page: 1 });
    expect(log.items[0]).toMatchObject({ movementType: "stocktake", previousQuantity: 13, newQuantity: 11 });
  });

  it("يمنع الكمية السالبة ولا يسجل حركة عند الرفض (S3)", async () => {
    const t = await variantWith(2);
    const error = await applyStockOperation({ type: "adjustment", ...t, delta: -3, reason: "تالف" }).then(
      () => null,
      (e: unknown) => toAppError(e),
    );
    expect(error).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(error?.message).toContain("المتاح");
    await expect(
      applyStockOperation({ type: "stocktake", ...t, newQuantity: -1, reason: "جرد" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      applyStockOperation({ type: "adjustment", ...t, delta: -1 }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await stockOf(t)).toBe(2);
    expect(await InventoryMovementModel.countDocuments({ variantId: t.variantId })).toBe(0);
  });

  it("20 خصمًا متوازيًا على مخزون 10: 10 ناجحة و10 مرفوضة والمخزون 0 و10 حركات (S8)", async () => {
    const t = await variantWith(10);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        mongoose.connection.transaction((session) =>
          changeVariantStock({ ...t, delta: -1, movementType: "adjustment", reason: "اختبار توازي" }, session),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(10);
    expect(await stockOf(t)).toBe(0);
    expect(await InventoryMovementModel.countDocuments({ variantId: t.variantId })).toBe(10);
    // تنبيه واحد لكل نوع رغم التوازي (DATABASE.md §3.5: low_stock يبقى مفتوحًا عند النفاد).
    expect((await openNotifications(t.variantId)).map((n) => n.type).sort()).toEqual([
      "low_stock",
      "out_of_stock",
    ]);
  });

  it("تصحيح الجرد يرفض إن تغيرت الكمية منذ قراءتها (قفل تفاؤلي)", async () => {
    const t = await variantWith(5);
    await expect(
      mongoose.connection.transaction((session) =>
        changeVariantStock(
          { ...t, delta: 2, movementType: "stocktake", reason: "جرد", expectedQuantity: 4 },
          session,
        ),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await stockOf(t)).toBe(5);
  });
});

describe("تنبيهات المخزون", () => {
  it("يظهر low_stock عند بلوغ الحد (S1)", async () => {
    const t = await variantWith(5, 3);
    await applyStockOperation({ type: "adjustment", ...t, delta: -1, reason: "بيع يدوي" });
    expect(await openNotifications(t.variantId)).toHaveLength(0);
    await applyStockOperation({ type: "adjustment", ...t, delta: -1, reason: "بيع يدوي" });
    const open = await openNotifications(t.variantId);
    expect(open.map((n) => [n.type, n.quantityAtTrigger])).toEqual([["low_stock", 3]]);
  });

  it("يظهر out_of_stock عند الصفر، ويصبح المنتج غير متوفر، ثم يُغلق بالتوريد (S2)", async () => {
    const t = await variantWith(2, 3);
    await applyStockOperation({ type: "adjustment", ...t, delta: -1, reason: "بيع يدوي" });
    expect((await openNotifications(t.variantId)).map((n) => n.type)).toEqual(["low_stock"]);
    await applyStockOperation({ type: "stocktake", ...t, newQuantity: 0, reason: "جرد" });
    // DATABASE.md §3.5: low_stock يبقى مفتوحًا لأنه سبق النفاد.
    expect((await openNotifications(t.variantId)).map((n) => n.type).sort()).toEqual([
      "low_stock",
      "out_of_stock",
    ]);
    expect((await ProductModel.findById(t.productId).orFail()).inStock).toBe(false);

    const out = await listInventory({ filter: "out", page: 1 });
    expect(out.items.map((row) => [row.variantId, row.status])).toEqual([[t.variantId, "out"]]);

    await applyStockOperation({ type: "restock", ...t, quantity: 1 });
    expect((await openNotifications(t.variantId)).map((n) => n.type)).toEqual(["low_stock"]);
    expect((await ProductModel.findById(t.productId).orFail()).inStock).toBe(true);
  });

  it("دورة التنبيه: انخفاض ثم تجديد يغلق، ثم انخفاض جديد ينشئ تنبيهًا جديدًا (S10)", async () => {
    const t = await variantWith(5, 3);
    await applyStockOperation({ type: "adjustment", ...t, delta: -3, reason: "بيع يدوي" });
    const [firstAlert] = await openNotifications(t.variantId);
    await applyStockOperation({ type: "restock", ...t, quantity: 10 });
    expect(await openNotifications(t.variantId)).toHaveLength(0);
    const closed = await NotificationModel.findById(firstAlert?._id).orFail();
    expect(closed.isOpen).toBe(false);
    expect(closed.resolvedAt).toBeInstanceOf(Date);

    await applyStockOperation({ type: "adjustment", ...t, delta: -10, reason: "بيع يدوي" });
    const reopened = await openNotifications(t.variantId);
    expect(reopened).toHaveLength(1);
    expect(reopened[0]?._id.toString()).not.toBe(firstAlert?._id.toString());
    expect(await NotificationModel.countDocuments({ variantId: t.variantId })).toBe(2);
  });

  it("تعديلات متكررة تحت الحد لا تنشئ إلا تنبيهًا مفتوحًا واحدًا (S12)", async () => {
    const t = await variantWith(3, 3);
    for (const delta of [-1, 1, -1, -1, 1]) {
      await applyStockOperation({ type: "adjustment", ...t, delta, reason: "تعديل متكرر" });
    }
    expect(await openNotifications(t.variantId, "low_stock")).toHaveLength(1);
  });

  it("فتح الـDashboard 5 مرات لا ينشئ تنبيهات جديدة (S11)", async () => {
    const t = await variantWith(1, 3);
    await ProductModel.updateOne({ _id: t.productId }, { $set: { "variants.0.stockQuantity": 0 } });
    for (let i = 0; i < 5; i += 1) await getDashboardStats();
    expect(await NotificationModel.countDocuments()).toBe(0);
  });

  it("تغيير حد التنبيه يفتح التنبيه أو يغلقه فورًا", async () => {
    const t = await variantWith(5, 3);
    await setLowStockThreshold({ ...t, lowStockThreshold: 6 });
    expect((await openNotifications(t.variantId)).map((n) => n.type)).toEqual(["low_stock"]);
    await setLowStockThreshold({ ...t, lowStockThreshold: 2 });
    expect(await openNotifications(t.variantId)).toHaveLength(0);
    await expect(setLowStockThreshold({ ...t, lowStockThreshold: -1 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("التعليم كمقروء لتنبيه واحد أو للكل", async () => {
    const a = await variantWith(1, 3);
    const b = await variantWith(1, 3);
    await setLowStockThreshold({ ...a, lowStockThreshold: 4 });
    await setLowStockThreshold({ ...b, lowStockThreshold: 4 });
    const list = await listNotifications({ onlyOpen: true, page: 1 });
    expect(list.items).toHaveLength(2);
    const [first] = list.items;
    if (!first) throw new Error("no notification");
    await markNotificationRead(first.id);
    expect((await NotificationModel.findById(first.id).orFail()).status).toBe("read");
    await expect(markNotificationRead("not-an-id")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await markAllNotificationsRead()).toBe(1);
    expect(await NotificationModel.countDocuments({ status: "unread" })).toBe(0);
  });
});
