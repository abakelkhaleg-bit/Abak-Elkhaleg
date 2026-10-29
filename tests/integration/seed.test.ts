import { describe, expect, it } from "vitest";
import { BrandModel } from "@/models/brand";
import { CategoryModel } from "@/models/category";
import { InventoryMovementModel } from "@/models/inventory-movement";
import { ProductModel } from "@/models/product";
import { StoreSettingsModel } from "@/models/store-settings";
import { seedDevData } from "../../scripts/seed/dev-data";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("seed-dev");

describe("seed:dev", () => {
  it("ينشئ بيانات صحيحة ومتسقة ويمكن تشغيله أكثر من مرة دون تكرار", async () => {
    const first = await seedDevData();
    expect(first).toEqual({
      categoriesCreated: 7,
      brandsCreated: 3,
      productsCreated: 6,
      movementsCreated: 9,
    });

    const second = await seedDevData();
    expect(second).toEqual({
      categoriesCreated: 0,
      brandsCreated: 0,
      productsCreated: 0,
      movementsCreated: 0,
    });

    expect(await CategoryModel.countDocuments()).toBe(7);
    expect(await BrandModel.countDocuments()).toBe(3);
    expect(await StoreSettingsModel.countDocuments()).toBe(1);

    const products = await ProductModel.find();
    expect(products).toHaveLength(6);
    for (const product of products) {
      await expect(product.validate()).resolves.toBeUndefined();
      expect(product.isPublished).toBe(true);
      expect(product.searchText.length).toBeGreaterThan(0);
    }

    // كل حجم له مخزون أولي > 0 له حركة initial تطابق كميته
    const movements = await InventoryMovementModel.find({ movementType: "initial" });
    for (const product of products) {
      for (const variant of product.variants.filter((v) => v.stockQuantity > 0)) {
        const match = movements.find((m) => m.variantId.equals(variant._id));
        expect(match?.newQuantity).toBe(variant.stockQuantity);
      }
    }
  });
});
