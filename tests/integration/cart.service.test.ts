import { describe, expect, it } from "vitest";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { ProductModel } from "@/models/product";
import { reviewCart } from "@/server/cart.service";
import { createRefs, newObjectId, productData } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("cart-service");

async function seedProduct(overrides: Record<string, unknown> = {}) {
  const refs = await createRefs();
  return ProductModel.create(
    productData(refs, {
      isPublished: true,
      variants: [
        { sizeMl: 50, price: 54_950, compareAtPrice: 65_000, stockQuantity: 3 },
        { sizeMl: 100, price: 89_900, stockQuantity: 40 },
        { sizeMl: 200, price: 150_000, stockQuantity: 0 },
        { sizeMl: 30, price: 10_000, stockQuantity: 9, isAvailable: false },
      ],
      ...overrides,
    }),
  );
}

const line = (product: Awaited<ReturnType<typeof seedProduct>>, index: number, quantity: number) => ({
  productId: product._id.toString(),
  variantId: product.variants[index]!._id.toString(),
  quantity,
});

describe("reviewCart", () => {
  it("يحسب الأسعار والإجمالي من قاعدة البيانات ويتجاهل أي سعر من المتصفح (W1/W5)", async () => {
    const product = await seedProduct();
    const review = await reviewCart([
      { ...line(product, 0, 2), price: 1, unitPrice: 1, total: 1 },
      line(product, 1, 1),
    ]);
    expect(review.lines.map((l) => [l.sizeMl, l.unitPrice, l.quantity, l.lineTotal])).toEqual([
      [50, 54_950, 2, 109_900],
      [100, 89_900, 1, 89_900],
    ]);
    expect(review.total).toBe(199_800);
    expect(review.itemCount).toBe(3);
    expect(review.lines[0]?.compareAtPrice).toBe(65_000);
  });

  it("يقص الكمية إلى المتاح (وإلى حد 20) ويعلّم البند كمعدّل (W2)", async () => {
    const product = await seedProduct();
    const review = await reviewCart([line(product, 0, 10), line(product, 1, 500)]);
    expect(review.lines.map((l) => [l.quantity, l.maxQuantity, l.status])).toEqual([
      [3, 3, "adjusted"],
      [20, 20, "adjusted"],
    ]);
  });

  it("يزيل غير المنشور، والحجم غير الموجود أو غير المتاح أو النافد (W3/W4)", async () => {
    const product = await seedProduct();
    const draft = await seedProduct({ isPublished: false, slug: "draft-x" });
    const review = await reviewCart([
      line(product, 2, 1), // نافد
      line(product, 3, 1), // غير متاح
      { productId: product._id.toString(), variantId: newObjectId().toString(), quantity: 1 },
      line(draft, 1, 1), // غير منشور
      { productId: newObjectId().toString(), variantId: newObjectId().toString(), quantity: 1 },
    ]);
    expect(review.lines).toHaveLength(0);
    expect(review.total).toBe(0);
    expect(review.removed.map((r) => r.reason)).toEqual([
      "out_of_stock",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
    ]);
  });

  it("يرفض المدخلات غير الصالحة دون أن يفشل، ويدمج البنود المكررة", async () => {
    const product = await seedProduct();
    const review = await reviewCart([
      line(product, 1, 1),
      line(product, 1, 2),
      { productId: { $ne: null }, variantId: "x", quantity: 1 },
      { productId: product._id.toString(), variantId: product.variants[1]!._id.toString(), quantity: -4 },
      "garbage",
    ]);
    expect(review.lines).toHaveLength(1);
    expect(review.lines[0]?.quantity).toBe(3);
    expect(review.removed.filter((r) => r.reason === "invalid")).toHaveLength(3);

    await expect(reviewCart("not-an-array")).resolves.toEqual({
      lines: [],
      removed: [],
      total: 0,
      itemCount: 0,
    });
  });

  it("مراجعة السلة لا تغيّر المخزون ولا تسجل حركات (S5)", async () => {
    const product = await seedProduct();
    const before = product.variants.map((v) => v.stockQuantity);
    await reviewCart([line(product, 0, 3), line(product, 1, 20)]);
    await reviewCart([line(product, 0, 3)]);
    const after = await ProductModel.findById(product._id).orFail();
    expect(after.variants.map((v) => v.stockQuantity)).toEqual(before);
    expect(await InventoryMovementModel.countDocuments()).toBe(0);
  });
});
