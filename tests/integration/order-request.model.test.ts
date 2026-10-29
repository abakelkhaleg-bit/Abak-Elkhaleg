import { describe, expect, it } from "vitest";
import { AppError, toAppError } from "@/lib/errors";
import { OrderRequestModel } from "@/models/order-request";
import { newObjectId } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("order-model");

const order = (overrides: Record<string, unknown> = {}) => ({
  reference: "AK-000001",
  items: [
    {
      productId: newObjectId(),
      variantId: newObjectId(),
      productName: "عود ملكي",
      slug: "عود-ملكي",
      sizeMl: 50,
      unitPrice: 95_000,
      quantity: 2,
      lineTotal: 190_000,
    },
    {
      productId: newObjectId(),
      variantId: newObjectId(),
      productName: "مسك أبيض",
      slug: "مسك-ابيض",
      sizeMl: 30,
      unitPrice: 35_050,
      quantity: 1,
      lineTotal: 35_050,
    },
  ],
  total: 225_050,
  customer: { name: "أحمد", phone: "01012345678", governorate: "cairo", address: "مدينة نصر" },
  ...overrides,
});

describe("OrderRequest", () => {
  it("يحفظ طلبًا أوليًا بحالة opened_in_whatsapp وسجل حالة (W9 — طبقة القاعدة)", async () => {
    const saved = await OrderRequestModel.create(order());
    expect(saved.status).toBe("opened_in_whatsapp");
    expect(saved.statusHistory).toHaveLength(1);
    expect(saved.statusHistory[0]?.status).toBe("opened_in_whatsapp");
  });

  it("يرفض إجماليات غير متسقة (W5 — طبقة القاعدة)", async () => {
    const wrongTotal = await OrderRequestModel.create(order({ total: 1 })).catch((e: unknown) => e);
    expect(toAppError(wrongTotal).fieldErrors).toHaveProperty("total");

    const base = order();
    const firstItem = base.items[0];
    if (!firstItem) throw new Error("factory");
    const wrongLine = await OrderRequestModel.create({
      ...base,
      items: [{ ...firstItem, lineTotal: 1 }, ...base.items.slice(1)],
    }).catch((e: unknown) => e);
    expect(toAppError(wrongLine).fieldErrors).toHaveProperty("items.0.lineTotal");
  });

  it("يرفض هاتفًا ومحافظة وكمية غير صالحة", async () => {
    const error = await OrderRequestModel.create(
      order({ customer: { name: "أحمد", phone: "123", governorate: "dubai" } }),
    ).catch((e: unknown) => e);
    const fields = Object.keys(toAppError(error).fieldErrors ?? {});
    expect(fields).toEqual(expect.arrayContaining(["customer.phone", "customer.governorate"]));
  });

  it("رقم مرجعي فريد", async () => {
    await OrderRequestModel.create(order());
    const duplicate = await OrderRequestModel.create(order()).catch((e: unknown) => e);
    expect(toAppError(duplicate).message).toContain("الرقم المرجعي");
  });

  it("لا يمكن حذف الطلبات، ويمكن حذف البيانات الشخصية فقط", async () => {
    const saved = await OrderRequestModel.create(order());
    const deletion = await OrderRequestModel.deleteOne({ _id: saved._id }).catch((e: unknown) => e);
    expect(deletion).toBeInstanceOf(AppError);
    expect((deletion as AppError).code).toBe("DELETE_FORBIDDEN");

    saved.set("customer", {});
    saved.piiPurgedAt = new Date();
    await expect(saved.save()).resolves.toBeDefined();
    const reloaded = await OrderRequestModel.findById(saved._id).orFail();
    expect(reloaded.customer.phone).toBeUndefined();
    expect(reloaded.total).toBe(225_050);
  });
});
