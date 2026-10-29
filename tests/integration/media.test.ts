import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, toAppError } from "@/lib/errors";
import { CategoryModel } from "@/models/category";
import { MediaAssetModel } from "@/models/media-asset";
import { ProductModel } from "@/models/product";
import { setupTestDatabase } from "../setup/test-db";

/**
 * M1–M10 (docs/TESTING.md). Cloudinary مستبدل بدوال مراقبة: لا اتصال بالشبكة،
 * ونتحقق من متى يُستدعى destroy بالضبط.
 */

const SECRET = "test-cloudinary-secret-value-123";
const API_KEY = "987654321012345";

const mocks = vi.hoisted(() => {
  process.env.APP_URL = "http://localhost:3000";
  let n = 0;
  return {
    admin: { loggedIn: true },
    storage: {
      upload: vi.fn(async (bytes: Buffer, folder: string) => {
        n += 1;
        const publicId = `abak-elkhalig/${folder}/test-${n}`;
        return {
          publicId,
          secureUrl: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.jpg`,
          format: "jpg",
          bytes: bytes.length,
          width: 8,
          height: 8,
        };
      }),
      destroy: vi.fn(async (_publicId: string) => undefined),
    },
  };
});

vi.mock("@/server/media/storage", () => ({
  MEDIA_ROOT_FOLDER: "abak-elkhalig",
  getMediaStorage: () => mocks.storage,
}));

vi.mock("@/server/auth/require-admin", () => ({
  requireAdmin: async () => {
    if (!mocks.admin.loggedIn) {
      throw new AppError("UNAUTHORIZED", "انتهت الجلسة أو لم تسجل الدخول. سجّل الدخول مجددًا.");
    }
    return { id: "507f1f77bcf86cd799439011", username: "owner" };
  },
  requireAdminPage: async () => ({ id: "507f1f77bcf86cd799439011", username: "owner" }),
}));

const { uploadImage, cleanupPendingMedia, deleteUnusedImages, MAX_UPLOAD_BYTES } = await import(
  "@/server/media.service"
);
const { createProduct, updateProduct } = await import("@/server/admin/products.admin.service");
const { createTaxonomy, updateTaxonomy } = await import("@/server/admin/taxonomy.admin.service");
const { POST } = await import("@/app/api/admin/uploads/route");

setupTestDatabase("media");

const jpeg = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: "#c9a227" } }).jpeg().toBuffer();
const png = () =>
  sharp({ create: { width: 8, height: 8, channels: 4, background: "#ffffff" } }).png().toBuffer();
const webp = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: "#000000" } }).webp().toBuffer();

const asRef = (image: { secureUrl: string; publicId: string }) => ({ ...image, altText: "" });

function uploadRequest(file: Blob, name: string, folder = "products", origin = "http://localhost:3000") {
  const body = new FormData();
  body.set("file", new File([file], name));
  body.set("folder", folder);
  return new Request("http://localhost:3000/api/admin/uploads", {
    method: "POST",
    body,
    headers: { origin },
  });
}

async function refs() {
  const category = await createTaxonomy("category", { name: "العود" });
  const brand = await createTaxonomy("brand", { name: "دار العود" });
  return { categoryId: category.id, brandId: brand.id };
}

const productInput = (
  r: { categoryId: string; brandId: string },
  images: Array<{ secureUrl: string; publicId: string; altText: string }>,
  name = "عود الإمارة",
) => ({
  name,
  shortDescription: "عود فاخر",
  categoryId: r.categoryId,
  brandId: r.brandId,
  images,
  variants: [{ sizeMl: 50, price: 50_000, initialStock: 4, lowStockThreshold: 3 }],
});

beforeEach(() => {
  mocks.admin.loggedIn = true;
  mocks.storage.upload.mockClear();
  mocks.storage.destroy.mockClear();
  process.env.CLOUDINARY_API_SECRET = SECRET;
  process.env.CLOUDINARY_API_KEY = API_KEY;
});

describe("رفع الصور", () => {
  it("JPEG وPNG وWebP صحيحة تنشئ MediaAsset بحالة pending (M1)", async () => {
    for (const bytes of [await jpeg(), await png(), await webp()]) {
      const image = await uploadImage(bytes, "products");
      const asset = await MediaAssetModel.findOne({ publicId: image.publicId }).orFail();
      expect(asset.status).toBe("pending");
      expect(asset.folder).toBe("products");
    }
    expect(mocks.storage.upload).toHaveBeenCalledTimes(3);
  });

  it("يرفض PDF وSVG وملفًا بامتداد .jpg ومحتوى مختلف (M2)", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const fakeJpg = Buffer.from("this is plain text pretending to be a jpg file");
    for (const bytes of [pdf, svg, fakeJpg]) {
      await expect(uploadImage(bytes, "products")).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
    }
    const response = await POST(uploadRequest(new Blob([fakeJpg]), "photo.jpg"));
    expect(response.status).toBe(415);
    expect(mocks.storage.upload).not.toHaveBeenCalled();
    expect(await MediaAssetModel.countDocuments()).toBe(0);
  });

  it("يرفض ملفًا أكبر من 4MB (M3)", async () => {
    const big = Buffer.concat([await jpeg(), Buffer.alloc(MAX_UPLOAD_BYTES)]);
    await expect(uploadImage(big, "products")).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    const response = await POST(uploadRequest(new Blob([big]), "big.jpg"));
    expect(response.status).toBe(413);
    expect(mocks.storage.upload).not.toHaveBeenCalled();
  });

  it("فشل Cloudinary يعيد رسالة واضحة ولا يغير بيانات المنتج (M4)", async () => {
    const r = await refs();
    const first = await uploadImage(await jpeg(), "products");
    const { id } = await createProduct(productInput(r, [asRef(first)]));
    const before = await ProductModel.findById(id).lean().orFail();

    mocks.storage.upload.mockRejectedValueOnce(new Error("ECONNRESET"));
    const error = await uploadImage(await jpeg(), "products").then(
      () => null,
      (e: unknown) => toAppError(e),
    );
    expect(error).toMatchObject({ code: "UPLOAD_FAILED" });
    expect(error?.message).toMatch(/تعذر رفع الصورة/);

    const after = await ProductModel.findById(id).lean().orFail();
    expect(after.images).toEqual(before.images);
    expect(await MediaAssetModel.countDocuments()).toBe(1);
  });

  it("الاستجابة لا تحتوي API key أو secret (M5)", async () => {
    const response = await POST(uploadRequest(new Blob([await jpeg()]), "a.jpg"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(API_KEY);
    expect(JSON.parse(text)).toMatchObject({ ok: true, image: { publicId: expect.any(String) } });
  });

  it("الرفع دون جلسة يُرفض بـ401 ولا يصل إلى Cloudinary (M9)", async () => {
    mocks.admin.loggedIn = false;
    const response = await POST(uploadRequest(new Blob([await jpeg()]), "a.jpg"));
    expect(response.status).toBe(401);
    expect(mocks.storage.upload).not.toHaveBeenCalled();
  });

  it("يرفض الرفع من Origin مختلف ووجهة غير معروفة", async () => {
    const foreign = await POST(uploadRequest(new Blob([await jpeg()]), "a.jpg", "products", "https://evil.example"));
    expect(foreign.status).toBe(403);
    const badFolder = await POST(uploadRequest(new Blob([await jpeg()]), "a.jpg", "../etc"));
    expect(badFolder.status).toBe(400);
    expect(mocks.storage.upload).not.toHaveBeenCalled();
  });
});

describe("ربط الصور وحذفها", () => {
  it("استبدال الرئيسية: الجديدة ترتيبها 0، والقديمة تُحذف بعد نجاح الحفظ فقط (M6)", async () => {
    const r = await refs();
    const oldImage = await uploadImage(await jpeg(), "products");
    const { id } = await createProduct(productInput(r, [asRef(oldImage)]));
    expect((await MediaAssetModel.findOne({ publicId: oldImage.publicId }).orFail()).status).toBe(
      "attached",
    );
    const newImage = await uploadImage(await jpeg(), "products");

    // حفظ فاشل (اسم غير صالح): لا حذف من Cloudinary ولا تغيير.
    await expect(
      updateProduct(id, productInput(r, [asRef(newImage)], "")),
    ).rejects.toBeInstanceOf(AppError);
    expect(mocks.storage.destroy).not.toHaveBeenCalled();
    expect((await ProductModel.findById(id).orFail()).images[0]?.publicId).toBe(oldImage.publicId);

    await updateProduct(id, productInput(r, [asRef(newImage)]));
    const product = await ProductModel.findById(id).orFail();
    expect(product.images.map((i) => [i.publicId, i.sortOrder])).toEqual([[newImage.publicId, 0]]);
    expect(mocks.storage.destroy).toHaveBeenCalledExactlyOnceWith(oldImage.publicId);
    expect(await MediaAssetModel.exists({ publicId: oldImage.publicId })).toBeNull();
  });

  it("حذف صورة غير مستخدمة يستدعي destroy (M7)", async () => {
    const image = await uploadImage(await jpeg(), "products");
    const result = await deleteUnusedImages([image.publicId]);
    expect(result.deleted).toEqual([image.publicId]);
    expect(mocks.storage.destroy).toHaveBeenCalledExactlyOnceWith(image.publicId);
  });

  it("لا يحذف صورة مستخدمة في تصنيف أو منتج آخر، ولا صورة خارج مجلد المشروع (M8)", async () => {
    const r = await refs();
    const shared = await uploadImage(await jpeg(), "products");
    const { id } = await createProduct(productInput(r, [asRef(shared)]));
    await updateTaxonomy("category", r.categoryId, { name: "العود", image: asRef(shared) });
    await createProduct(productInput(r, [asRef(shared)], "عود ثانٍ"));

    const other = await uploadImage(await jpeg(), "products");
    await updateProduct(id, productInput(r, [asRef(other)]));
    expect(mocks.storage.destroy).not.toHaveBeenCalled();

    const result = await deleteUnusedImages(["samples/demo-image", shared.publicId]);
    expect(result.deleted).toEqual([]);
    expect(result.kept.sort()).toEqual(["samples/demo-image", shared.publicId].sort());
    expect(mocks.storage.destroy).not.toHaveBeenCalled();
    expect((await CategoryModel.findById(r.categoryId).orFail()).image?.publicId).toBe(shared.publicId);
  });

  it("يرفض صورة لم تُرفع عبر الخدمة (رابط أو معرّف مزوّر)", async () => {
    const r = await refs();
    const forged = {
      secureUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/abak-elkhalig/products/forged.jpg",
      publicId: "abak-elkhalig/products/forged",
      altText: "",
    };
    await expect(createProduct(productInput(r, [forged]))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      createTaxonomy("brand", { name: "ماركة", logo: forged }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("استبدال شعار الماركة يحذف القديم بعد الحفظ", async () => {
    const first = await uploadImage(await png(), "brands");
    const { id } = await createTaxonomy("brand", { name: "دار المسك", logo: asRef(first) });
    const second = await uploadImage(await png(), "brands");
    await updateTaxonomy("brand", id, { name: "دار المسك", logo: asRef(second) });
    expect(mocks.storage.destroy).toHaveBeenCalledExactlyOnceWith(first.publicId);
  });

  it("التنظيف يحذف الأصول المعلقة الأقدم من 24 ساعة فقط (M10)", async () => {
    const r = await refs();
    const stale = await uploadImage(await jpeg(), "products");
    const fresh = await uploadImage(await jpeg(), "products");
    const staleButUsed = await uploadImage(await jpeg(), "products");
    await createProduct(productInput(r, [asRef(staleButUsed)]));
    await MediaAssetModel.updateOne({ publicId: staleButUsed.publicId }, { status: "pending" });

    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await MediaAssetModel.collection.updateMany(
      { publicId: { $in: [stale.publicId, staleButUsed.publicId] } },
      { $set: { createdAt: old } },
    );

    const result = await cleanupPendingMedia();
    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(mocks.storage.destroy).toHaveBeenCalledExactlyOnceWith(stale.publicId);
    expect(await MediaAssetModel.exists({ publicId: fresh.publicId })).not.toBeNull();
    expect((await MediaAssetModel.findOne({ publicId: staleButUsed.publicId }).orFail()).status).toBe(
      "attached",
    );
  });
});
