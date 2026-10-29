import { describe, expect, it } from "vitest";
import { AppError, toAppError } from "@/lib/errors";
import { BrandModel } from "@/models/brand";
import { CategoryModel } from "@/models/category";
import { ProductModel } from "@/models/product";
import { createBrand, createCategory, createRefs, productData } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("taxonomy-model");

describe("Category / Brand", () => {
  it("يرفض slug مكررًا واسمًا مكررًا بعد التطبيع", async () => {
    await createCategory({ name: "العطور الشرقية", slug: "oriental" });
    const sameSlug = await createCategory({ slug: "oriental" }).catch((e: unknown) => e);
    expect(toAppError(sameSlug).message).toContain("الرابط (slug)");

    const sameNormalizedName = await createCategory({ name: "العطور الشرقيه" }).catch((e: unknown) => e);
    expect(toAppError(sameNormalizedName).message).toContain("الاسم مستخدم بالفعل");
  });

  it("يرفض حذف تصنيف مرتبط بمنتجات بكل طرق الحذف (P13)", async () => {
    const refs = await createRefs();
    await ProductModel.create(productData(refs));
    const category = await CategoryModel.findById(refs.categoryId).orFail();

    const attempts = [
      () => CategoryModel.deleteOne({ _id: refs.categoryId }),
      () => CategoryModel.findOneAndDelete({ _id: refs.categoryId }),
      () => CategoryModel.deleteMany({}),
      () => category.deleteOne(),
    ];
    for (const attempt of attempts) {
      const error = await attempt().then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("CATEGORY_IN_USE");
      expect((error as AppError).message).toContain("مرتبط بـ1 منتج");
    }
    expect(await CategoryModel.countDocuments()).toBe(1);
  });

  it("يسمح بحذف تصنيف غير مرتبط", async () => {
    const category = await createCategory();
    await CategoryModel.deleteOne({ _id: category._id });
    expect(await CategoryModel.exists({ _id: category._id })).toBeNull();
  });

  it("الإخفاء متاح دائمًا حتى مع وجود منتجات", async () => {
    const refs = await createRefs();
    await ProductModel.create(productData(refs));
    await CategoryModel.updateOne({ _id: refs.categoryId }, { isActive: false });
    expect((await CategoryModel.findById(refs.categoryId).orFail()).isActive).toBe(false);
  });

  it("يرفض حذف ماركة مرتبطة ويسمح بغير المرتبطة", async () => {
    const refs = await createRefs();
    await ProductModel.create(productData(refs));
    const error = await BrandModel.deleteOne({ _id: refs.brandId }).catch((e: unknown) => e);
    expect((error as AppError).code).toBe("BRAND_IN_USE");

    const free = await createBrand();
    await expect(BrandModel.deleteOne({ _id: free._id })).resolves.toMatchObject({ deletedCount: 1 });
  });
});
