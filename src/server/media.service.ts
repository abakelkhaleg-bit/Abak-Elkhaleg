import "server-only";
import { fileTypeFromBuffer } from "file-type";
import { connectToDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { MediaFolder } from "@/lib/validation-rules";
import { BrandModel, type Brand } from "@/models/brand";
import { CategoryModel, type Category } from "@/models/category";
import { MediaAssetModel } from "@/models/media-asset";
import { ProductModel, type Product } from "@/models/product";
import { StoreSettingsModel } from "@/models/store-settings";
import { trusted } from "@/models/_mongoose";
import { getMediaStorage, MEDIA_ROOT_FOLDER } from "@/server/media/storage";

/**
 * خدمة الصور (docs/decisions/0007-server-side-image-upload.md):
 * - الرفع: فحص الحجم ثم النوع الفعلي من البايتات (magic bytes) ثم Cloudinary، وتسجيل MediaAsset(pending).
 * - الربط: عند حفظ كيان تتحول صوره إلى attached.
 * - الحذف: فقط بعد نجاح العملية الأصلية، وفقط إن لم تُستخدم الصورة في أي مكان آخر،
 *   وفقط داخل مجلد المشروع (abak-elkhalig/). فشل الحذف يُسجَّل ولا يفسد بيانات الكيان.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const PENDING_MEDIA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type UploadedImage = { publicId: string; secureUrl: string; width: number; height: number };
export type ImageRef = { secureUrl: string; publicId: string; altText?: string };

export async function assertAllowedImage(bytes: Buffer): Promise<void> {
  if (bytes.length === 0) throw new AppError("EMPTY_FILE", "الملف فارغ.");
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      "حجم الصورة أكبر من 4 ميجابايت. صغّر الصورة ثم أعد المحاولة.",
    );
  }
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    throw new AppError(
      "UNSUPPORTED_TYPE",
      "نوع الملف غير مسموح. الأنواع المقبولة: JPEG وPNG وWebP وAVIF.",
    );
  }
}

export async function uploadImage(bytes: Buffer, folder: MediaFolder): Promise<UploadedImage> {
  await assertAllowedImage(bytes);
  let stored;
  try {
    stored = await getMediaStorage().upload(bytes, folder);
  } catch (error) {
    logger.error("فشل رفع الصورة إلى Cloudinary", { error });
    throw new AppError("UPLOAD_FAILED", "تعذر رفع الصورة الآن، حاول مرة أخرى.");
  }
  await connectToDatabase();
  await MediaAssetModel.create({ ...stored, folder, status: "pending" });
  return {
    publicId: stored.publicId,
    secureUrl: stored.secureUrl,
    width: stored.width,
    height: stored.height,
  };
}

/**
 * يتحقق أن كل صورة في المدخلات إما موجودة مسبقًا في الكيان، أو رُفعت عبر خدمة الصور
 * (MediaAsset بنفس الرابط). يمنع إدخال روابط خارجية أو معرّفات مزوّرة.
 * يعيد معرّفات الصور الجديدة (لربطها بعد الحفظ).
 */
export async function assertKnownImages(
  images: ImageRef[],
  existing: Iterable<string>,
): Promise<string[]> {
  const known = new Set(existing);
  const candidates = images.filter((image) => !known.has(image.publicId));
  if (candidates.length === 0) return [];
  await connectToDatabase();
  const assets = await MediaAssetModel.find(
    { publicId: trusted({ $in: candidates.map((image) => image.publicId) }) },
    { publicId: 1, secureUrl: 1 },
  ).lean();
  const byId = new Map(assets.map((asset) => [asset.publicId, asset.secureUrl]));
  const unknown = candidates.find((image) => byId.get(image.publicId) !== image.secureUrl);
  if (unknown) {
    throw new AppError("VALIDATION", "صورة غير معروفة. ارفع الصور من مدير الصور فقط.", {
      images: ["صورة غير معروفة."],
    });
  }
  return candidates.map((image) => image.publicId);
}

export async function markAttached(publicIds: string[]): Promise<void> {
  if (publicIds.length === 0) return;
  await connectToDatabase();
  await MediaAssetModel.updateMany(
    { publicId: trusted({ $in: publicIds }) },
    { status: "attached" },
  );
}

/** المعرّفات المستخدمة حاليًا في أي كيان (منتجات، تصنيفات، ماركات، إعدادات). */
export async function publicIdsInUse(publicIds: string[]): Promise<Set<string>> {
  if (publicIds.length === 0) return new Set();
  await connectToDatabase();
  const inList = () => trusted({ $in: publicIds });
  const [products, ogProducts, categories, brands, settings] = await Promise.all([
    ProductModel.find({ "images.publicId": inList() }, { images: 1 }).lean<
      Array<Pick<Product, "images">>
    >(),
    ProductModel.find({ "seo.ogImagePublicId": inList() }, { seo: 1 }).lean<
      Array<Pick<Product, "seo">>
    >(),
    CategoryModel.find({ "image.publicId": inList() }, { image: 1 }).lean<
      Array<Pick<Category, "image">>
    >(),
    BrandModel.find({ "logo.publicId": inList() }, { logo: 1 }).lean<Array<Pick<Brand, "logo">>>(),
    StoreSettingsModel.find({}).lean(),
  ]);
  const wanted = new Set(publicIds);
  const used = new Set<string>();
  const add = (id?: string | null) => {
    if (id && wanted.has(id)) used.add(id);
  };
  products.forEach((p) => p.images.forEach((image) => add(image.publicId)));
  ogProducts.forEach((p) => add(p.seo?.ogImagePublicId));
  categories.forEach((c) => add(c.image?.publicId));
  brands.forEach((b) => add(b.logo?.publicId));
  settings.forEach((s) => {
    add(s.logo?.publicId);
    add(s.defaultSeo?.ogImage?.publicId);
    add(s.homepage?.heroImage?.publicId);
    s.homepage?.promoBanners?.forEach((banner) => add(banner.image?.publicId));
  });
  return used;
}

/**
 * يحذف من Cloudinary الصور غير المستخدمة فقط، وداخل مجلد المشروع فقط
 * (صور demo أو صور خارجية لا تُحذف أبدًا). لا يرمي: الفشل يُسجَّل ويُعاد في النتيجة.
 */
export async function deleteUnusedImages(
  publicIds: string[],
): Promise<{ deleted: string[]; kept: string[]; failed: string[] }> {
  const unique = [...new Set(publicIds)];
  const ours = unique.filter((id) => id.startsWith(`${MEDIA_ROOT_FOLDER}/`));
  const inUse = await publicIdsInUse(ours);
  const deletable = ours.filter((id) => !inUse.has(id));
  const result = {
    deleted: [] as string[],
    kept: unique.filter((id) => !deletable.includes(id)),
    failed: [] as string[],
  };
  for (const publicId of deletable) {
    try {
      await getMediaStorage().destroy(publicId);
      await MediaAssetModel.deleteOne({ publicId });
      result.deleted.push(publicId);
    } catch (error) {
      logger.error("فشل حذف صورة من Cloudinary؛ ستُعاد المحاولة في التنظيف القادم", {
        error,
        publicId,
      });
      result.failed.push(publicId);
    }
  }
  return result;
}

/** ينظف الصور المرفوعة التي لم تُربط بأي كيان خلال 24 ساعة (cron). */
export async function cleanupPendingMedia(
  maxAgeMs = PENDING_MEDIA_MAX_AGE_MS,
): Promise<{ deleted: number; failed: number }> {
  await connectToDatabase();
  const stale = await MediaAssetModel.find(
    { status: "pending", createdAt: trusted({ $lt: new Date(Date.now() - maxAgeMs) }) },
    { publicId: 1 },
  )
    .limit(200)
    .lean();
  const result = await deleteUnusedImages(stale.map((asset) => asset.publicId));
  // صور معلقة لكنها مستخدمة فعليًا (حالة نادرة) تُصحح حالتها.
  await markAttached(result.kept.filter((id) => id.startsWith(`${MEDIA_ROOT_FOLDER}/`)));
  return { deleted: result.deleted.length, failed: result.failed.length };
}
