import { describe, expect, it } from "vitest";
import { AppError, isDuplicateKeyError, toAppError } from "@/lib/errors";
import { InventoryMovementModel, type InventoryMovement } from "@/models/inventory-movement";
import { NotificationModel, type Notification } from "@/models/notification";
import { newObjectId } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("inventory-model");

const movement = (overrides: Partial<InventoryMovement> = {}): Partial<InventoryMovement> => ({
  productId: newObjectId(),
  variantId: newObjectId(),
  productName: "عود ملكي",
  sizeMl: 50,
  movementType: "restock",
  quantityDelta: 5,
  previousQuantity: 2,
  newQuantity: 7,
  ...overrides,
});

describe("InventoryMovement", () => {
  it("يسجل حركة صحيحة بالقيم السابقة والجديدة والتاريخ (S9)", async () => {
    const saved = await InventoryMovementModel.create(
      movement({ movementType: "adjustment", quantityDelta: -2, newQuantity: 0, reason: "عبوة تالفة" }),
    );
    expect(saved.previousQuantity).toBe(2);
    expect(saved.newQuantity).toBe(0);
    expect(saved.reason).toBe("عبوة تالفة");
    expect(saved.createdAt).toBeInstanceOf(Date);
  });

  it("يرفض حركة لا تتسق قيمها أو تنتج كمية سالبة (S3)", async () => {
    const inconsistent = await InventoryMovementModel.create(movement({ newQuantity: 99 })).catch(
      (e: unknown) => e,
    );
    expect(toAppError(inconsistent).fieldErrors).toHaveProperty("newQuantity");

    const negative = await InventoryMovementModel.create(
      movement({ quantityDelta: -5, newQuantity: -3 }),
    ).catch((e: unknown) => e);
    expect(toAppError(negative).fieldErrors?.newQuantity?.join()).toContain("سالبة");
  });

  it("يتطلب سببًا للتعديل والجرد، وطلبًا لحركات البيع", async () => {
    const noReason = await InventoryMovementModel.create(
      movement({ movementType: "adjustment" }),
    ).catch((e: unknown) => e);
    expect(toAppError(noReason).fieldErrors).toHaveProperty("reason");

    const saleWithoutOrder = await InventoryMovementModel.create(
      movement({ movementType: "sale", quantityDelta: -1, newQuantity: 1 }),
    ).catch((e: unknown) => e);
    expect(toAppError(saleWithoutOrder).fieldErrors).toHaveProperty("orderId");
  });

  it("السجل للإضافة فقط: لا تعديل ولا حذف", async () => {
    const saved = await InventoryMovementModel.create(movement());
    const attempts: Array<() => PromiseLike<unknown>> = [
      () => InventoryMovementModel.updateOne({ _id: saved._id }, { reason: "تلاعب" }),
      () => InventoryMovementModel.findOneAndUpdate({ _id: saved._id }, { newQuantity: 100 }),
      () => InventoryMovementModel.deleteOne({ _id: saved._id }),
      () => InventoryMovementModel.deleteMany({}),
      () => saved.deleteOne(),
      () => {
        saved.reason = "تلاعب";
        return saved.save();
      },
    ];
    for (const attempt of attempts) {
      const error = await Promise.resolve()
        .then(attempt)
        .then(
          () => null,
          (caught: unknown) => caught,
        );
      expect(error).toBeInstanceOf(AppError);
    }
    const reloaded = await InventoryMovementModel.findById(saved._id).orFail();
    expect(reloaded.newQuantity).toBe(7);
  });

  it("يمنع تسجيل خصم نفس بند الطلب مرتين (S7 — طبقة القاعدة)", async () => {
    const orderId = newObjectId();
    const variantId = newObjectId();
    const sale = movement({
      movementType: "sale",
      orderId,
      variantId,
      quantityDelta: -1,
      previousQuantity: 5,
      newQuantity: 4,
    });
    await InventoryMovementModel.create(sale);
    const duplicate = await InventoryMovementModel.create(sale).catch((e: unknown) => e);
    expect(isDuplicateKeyError(duplicate)).toBe(true);

    // نفس الطلب لكن إرجاع (نوع مختلف) مسموح
    await expect(
      InventoryMovementModel.create({
        ...sale,
        movementType: "order_cancel_restore",
        quantityDelta: 1,
        previousQuantity: 4,
        newQuantity: 5,
      }),
    ).resolves.toBeDefined();
  });
});

describe("Notification", () => {
  const notification = (overrides: Partial<Notification> = {}): Partial<Notification> => ({
    type: "low_stock",
    productId: newObjectId(),
    variantId: newObjectId(),
    productName: "عود ملكي",
    sizeMl: 50,
    quantityAtTrigger: 2,
    message: "عود ملكي — 50ml: المتبقي 2",
    ...overrides,
  });

  it("تنبيه مفتوح واحد فقط لكل حجم ونوع (S12)", async () => {
    const first = await NotificationModel.create(notification());
    const duplicate = await NotificationModel.create(
      notification({ variantId: first.variantId, productId: first.productId }),
    ).catch((e: unknown) => e);
    expect(isDuplicateKeyError(duplicate)).toBe(true);

    // نوع مختلف لنفس الحجم مسموح (low_stock + out_of_stock)
    await expect(
      NotificationModel.create(
        notification({ variantId: first.variantId, productId: first.productId, type: "out_of_stock" }),
      ),
    ).resolves.toBeDefined();
  });

  it("بعد إغلاق الدورة يمكن فتح تنبيه جديد لنفس الحجم (S10 — طبقة القاعدة)", async () => {
    const first = await NotificationModel.create(notification());
    await NotificationModel.updateOne(
      { _id: first._id },
      { isOpen: false, resolvedAt: new Date() },
    );
    const second = await NotificationModel.create(
      notification({ variantId: first.variantId, productId: first.productId }),
    );
    expect(second._id.equals(first._id)).toBe(false);
    expect(await NotificationModel.countDocuments({ variantId: first.variantId })).toBe(2);
  });

  it("الحالة الافتراضية unread والتنبيه المفتوح بلا تاريخ إغلاق", async () => {
    const saved = await NotificationModel.create(notification());
    expect(saved.status).toBe("unread");
    expect(saved.isOpen).toBe(true);
    const invalid = await NotificationModel.create(
      notification({ resolvedAt: new Date() }),
    ).catch((e: unknown) => e);
    expect(toAppError(invalid).fieldErrors).toHaveProperty("resolvedAt");
  });
});
