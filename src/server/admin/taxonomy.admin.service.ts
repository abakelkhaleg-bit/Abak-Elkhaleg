import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { BrandModel } from "@/models/brand";
import { CategoryModel, type TaxonomyImage } from "@/models/category";
import { ProductModel } from "@/models/product";
import { withSlugFallback } from "@/schemas/common";
import { brandInputSchema, categoryInputSchema } from "@/schemas/taxonomy";
import { refreshSearchTextFor } from "@/server/admin/products.admin.service";
import { assertObjectId, parseInput } from "@/server/admin/validate";
import { assertKnownImages, deleteUnusedImages, markAttached } from "@/server/media.service";

/**
 * إدارة التصنيفات والماركات. الحذف المرتبط بمنتجات يرفضه النموذج نفسه (_guards.ts)
 * برسالة توضح عدد المنتجات. صورة التصنيف وشعار الماركة يُرفعان عبر مدير الصور،
 * والصورة القديمة تُحذف من Cloudinary بعد نجاح الحفظ فقط.
 */

export type TaxonomyKind = "category" | "brand";

export type AdminTaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  imageUrl: string | null;
  image: TaxonomyImage | null;
  seo: { title: string; description: string };
};

const imageField = (kind: TaxonomyKind) => (kind === "category" ? "image" : "logo");

const productField = (kind: TaxonomyKind) => (kind === "category" ? "categoryId" : "brandId");
const label = (kind: TaxonomyKind) => (kind === "category" ? "التصنيف" : "الماركة");

export async function listTaxonomyForAdmin(kind: TaxonomyKind): Promise<AdminTaxonomyRow[]> {
  await connectToDatabase();
  const docs = await (kind === "category"
    ? CategoryModel.find().sort({ sortOrder: 1, name: 1 }).lean()
    : BrandModel.find().sort({ sortOrder: 1, name: 1 }).lean());
  const counts = await ProductModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $group: { _id: `$${productField(kind)}`, count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [row._id.toString(), row.count]));
  return docs.map((doc) => {
    const image = "image" in doc ? doc.image : "logo" in doc ? doc.logo : undefined;
    return {
      id: doc._id.toString(),
      name: doc.name,
      slug: doc.slug,
      description: doc.description,
      isActive: doc.isActive,
      sortOrder: doc.sortOrder,
      productCount: countMap.get(doc._id.toString()) ?? 0,
      imageUrl: image?.secureUrl ?? null,
      image: image
        ? { secureUrl: image.secureUrl, publicId: image.publicId, altText: image.altText ?? "" }
        : null,
      seo: { title: doc.seo?.title ?? "", description: doc.seo?.description ?? "" },
    };
  });
}

export async function getTaxonomyForEdit(kind: TaxonomyKind, id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const rows = await listTaxonomyForAdmin(kind);
  return rows.find((row) => row.id === id) ?? null;
}

function parse(kind: TaxonomyKind, rawInput: unknown) {
  const input =
    kind === "category"
      ? parseInput(categoryInputSchema, rawInput)
      : parseInput(brandInputSchema, rawInput);
  const { slug } = withSlugFallback(input);
  const image = "image" in input ? input.image : "logo" in input ? input.logo : undefined;
  return {
    fields: {
      name: input.name,
      slug,
      description: input.description ?? "",
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      seo: { title: input.seo.title, description: input.seo.description },
    },
    image,
  };
}

export async function createTaxonomy(kind: TaxonomyKind, rawInput: unknown): Promise<{ id: string }> {
  const { fields, image } = parse(kind, rawInput);
  const newImageIds = await assertKnownImages(image ? [image] : [], []);
  await connectToDatabase();
  const data = { ...fields, ...(image ? { [imageField(kind)]: image } : {}) };
  const doc =
    kind === "category" ? await CategoryModel.create(data) : await BrandModel.create(data);
  await markAttached(newImageIds);
  return { id: doc._id.toString() };
}

export async function updateTaxonomy(
  kind: TaxonomyKind,
  rawId: unknown,
  rawInput: unknown,
): Promise<{ id: string }> {
  const id = assertObjectId(rawId, label(kind));
  const { fields, image } = parse(kind, rawInput);
  await connectToDatabase();
  const doc = await (kind === "category" ? CategoryModel.findById(id) : BrandModel.findById(id));
  if (!doc) throw new AppError("NOT_FOUND", `${label(kind)} غير موجود أو حُذف.`);
  const field = imageField(kind);
  const previous = doc.get(field) as TaxonomyImage | undefined;
  const previousId = previous?.publicId;
  const newImageIds = await assertKnownImages(image ? [image] : [], previousId ? [previousId] : []);
  const nameChanged = doc.name !== fields.name;
  doc.set(fields);
  doc.set(field, image ?? undefined);
  await doc.save();
  await markAttached(newImageIds);
  if (previousId && previousId !== image?.publicId) await deleteUnusedImages([previousId]);
  if (nameChanged) await refreshSearchTextFor({ [productField(kind)]: id });
  return { id };
}

export async function setTaxonomyActive(kind: TaxonomyKind, rawId: unknown, isActive: boolean) {
  const id = assertObjectId(rawId, label(kind));
  await connectToDatabase();
  const result = await (kind === "category"
    ? CategoryModel.updateOne({ _id: id }, { isActive })
    : BrandModel.updateOne({ _id: id }, { isActive }));
  if (result.matchedCount === 0) throw new AppError("NOT_FOUND", `${label(kind)} غير موجود أو حُذف.`);
}

export async function deleteTaxonomy(kind: TaxonomyKind, rawId: unknown): Promise<void> {
  const id = assertObjectId(rawId, label(kind));
  await connectToDatabase();
  const existing = await (kind === "category"
    ? CategoryModel.findById(id, { image: 1 }).lean()
    : BrandModel.findById(id, { logo: 1 }).lean());
  const imageId =
    existing && "image" in existing
      ? existing.image?.publicId
      : existing && "logo" in existing
        ? existing.logo?.publicId
        : undefined;
  const result = await (kind === "category"
    ? CategoryModel.deleteOne({ _id: id })
    : BrandModel.deleteOne({ _id: id }));
  if (result.deletedCount === 0) throw new AppError("NOT_FOUND", `${label(kind)} غير موجود أو حُذف.`);
  if (imageId) await deleteUnusedImages([imageId]);
}
