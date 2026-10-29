import { Schema, type HydratedDocument, type Model } from "mongoose";
import { normalizeArabic } from "@/lib/arabic-normalize";
import { LIMITS, SLUG_PATTERN } from "@/lib/validation-rules";
import { blockDeleteWhileProductsReference } from "@/models/_guards";
import { defineModel, integerValidator } from "@/models/_mongoose";
import {
  taxonomyImageSchema,
  taxonomySeoDefinition,
  type TaxonomyImage,
  type TaxonomySeo,
} from "@/models/category";

/** راجع docs/DATABASE.md §3.3. */

export interface Brand {
  name: string;
  nameKey: string;
  slug: string;
  description: string;
  logo?: TaxonomyImage;
  isActive: boolean;
  sortOrder: number;
  seo: TaxonomySeo;
  createdAt: Date;
  updatedAt: Date;
}

export type BrandDocument = HydratedDocument<Brand>;
export type BrandModel = Model<Brand>;

const brandSchema = new Schema<Brand, BrandModel>(
  {
    name: {
      type: String,
      required: [true, "اسم الماركة مطلوب."],
      trim: true,
      minlength: [LIMITS.brandName.min, "اسم الماركة قصير جدًا."],
      maxlength: [LIMITS.brandName.max, "اسم الماركة طويل جدًا."],
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
    logo: { type: taxonomyImageSchema, required: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, validate: integerValidator },
    seo: taxonomySeoDefinition,
  },
  { timestamps: true },
);

brandSchema.pre("validate", function () {
  this.nameKey = normalizeArabic(this.name ?? "");
});

brandSchema.index({ slug: 1 }, { unique: true });
brandSchema.index({ nameKey: 1 }, { unique: true });
brandSchema.index({ isActive: 1, name: 1 });
brandSchema.index({ "logo.publicId": 1 });

blockDeleteWhileProductsReference(brandSchema, {
  productField: "brandId",
  code: "BRAND_IN_USE",
  entityLabel: "الماركة",
});

export const BrandModel = defineModel<Brand, BrandModel>("Brand", brandSchema);
