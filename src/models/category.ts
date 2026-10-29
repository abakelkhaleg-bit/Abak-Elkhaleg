import { Schema, type HydratedDocument, type Model } from "mongoose";
import { normalizeArabic } from "@/lib/arabic-normalize";
import { CLOUDINARY_URL_PATTERN, LIMITS, SLUG_PATTERN } from "@/lib/validation-rules";
import { blockDeleteWhileProductsReference } from "@/models/_guards";
import { defineModel, integerValidator } from "@/models/_mongoose";

/** راجع docs/DATABASE.md §3.2. */

export interface TaxonomyImage {
  secureUrl: string;
  publicId: string;
  altText: string;
}

export interface TaxonomySeo {
  title?: string;
  description?: string;
}

export interface Category {
  name: string;
  /** الاسم بعد التطبيع — لمنع تكرار الأسماء المتشابهة (إطلالة/اطلاله). */
  nameKey: string;
  slug: string;
  description: string;
  image?: TaxonomyImage;
  isActive: boolean;
  sortOrder: number;
  seo: TaxonomySeo;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<Category>;
export type CategoryModel = Model<Category>;

export const taxonomyImageSchema = new Schema<TaxonomyImage>(
  {
    secureUrl: {
      type: String,
      required: true,
      match: [CLOUDINARY_URL_PATTERN, "رابط الصورة يجب أن يكون من Cloudinary (https)."],
    },
    publicId: { type: String, required: true, trim: true },
    altText: { type: String, trim: true, maxlength: LIMITS.altText.max, default: "" },
  },
  { _id: false },
);

export const taxonomySeoDefinition = {
  title: { type: String, trim: true, maxlength: LIMITS.seoTitle.max },
  description: { type: String, trim: true, maxlength: LIMITS.seoDescription.max },
};

const categorySchema = new Schema<Category, CategoryModel>(
  {
    name: {
      type: String,
      required: [true, "اسم التصنيف مطلوب."],
      trim: true,
      minlength: [LIMITS.categoryName.min, "اسم التصنيف قصير جدًا."],
      maxlength: [LIMITS.categoryName.max, "اسم التصنيف طويل جدًا."],
    },
    nameKey: { type: String, required: true },
    slug: {
      type: String,
      required: [true, "الرابط (slug) مطلوب."],
      trim: true,
      match: [SLUG_PATTERN, "الرابط (slug) يحتوي على رموز غير مسموحة."],
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: LIMITS.taxonomyDescription.max,
    },
    image: { type: taxonomyImageSchema, required: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, validate: integerValidator },
    seo: taxonomySeoDefinition,
  },
  { timestamps: true },
);

categorySchema.pre("validate", function () {
  this.nameKey = normalizeArabic(this.name ?? "");
});

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ nameKey: 1 }, { unique: true });
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ "image.publicId": 1 });

blockDeleteWhileProductsReference(categorySchema, {
  productField: "categoryId",
  code: "CATEGORY_IN_USE",
  entityLabel: "التصنيف",
});

export const CategoryModel = defineModel<Category, CategoryModel>("Category", categorySchema);
