import { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import { buildSearchText } from "@/lib/arabic-normalize";
import {
  CLOUDINARY_URL_PATTERN,
  LIMITS,
  SKU_PATTERN,
  SLUG_PATTERN,
} from "@/lib/validation-rules";
import { defineModel, integerValidator } from "@/models/_mongoose";

/** راجع docs/DATABASE.md §3.1. كل المبالغ بالقروش. */

export interface ProductImage {
  _id: Types.ObjectId;
  secureUrl: string;
  publicId: string;
  altText: string;
  sortOrder: number;
  width?: number;
  height?: number;
}

export interface ProductVariant {
  _id: Types.ObjectId;
  sizeMl: number;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  isAvailable: boolean;
}

export interface ProductSeo {
  title?: string;
  description?: string;
  ogImagePublicId?: string;
}

export interface Product {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: Types.ObjectId;
  brandId: Types.ObjectId;
  images: ProductImage[];
  variants: ProductVariant[];
  isPublished: boolean;
  isFeatured: boolean;
  hideFromOffers: boolean;
  isOnSale: boolean;
  sortOrder: number;
  seo: ProductSeo;
  minPrice: number;
  inStock: boolean;
  searchText: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<Product>;
export type ProductModel = Model<Product>;

const imageSchema = new Schema<ProductImage>({
  secureUrl: {
    type: String,
    required: [true, "رابط الصورة مطلوب."],
    match: [CLOUDINARY_URL_PATTERN, "رابط الصورة يجب أن يكون من Cloudinary (https)."],
  },
  publicId: { type: String, required: [true, "معرّف الصورة مطلوب."], trim: true },
  altText: { type: String, trim: true, maxlength: LIMITS.altText.max, default: "" },
  sortOrder: { type: Number, default: 0, validate: integerValidator },
  width: { type: Number, min: 1, validate: integerValidator },
  height: { type: Number, min: 1, validate: integerValidator },
});

const variantSchema = new Schema<ProductVariant>({
  sizeMl: {
    type: Number,
    required: [true, "الحجم (ml) مطلوب."],
    min: [LIMITS.sizeMl.min, "الحجم غير صالح."],
    max: [LIMITS.sizeMl.max, "الحجم غير صالح."],
    validate: integerValidator,
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true,
    match: [SKU_PATTERN, "رمز SKU يجب أن يتكون من حروف إنجليزية كبيرة وأرقام وشرطات (3–40)."],
  },
  price: {
    type: Number,
    required: [true, "السعر مطلوب."],
    min: [1, "السعر يجب أن يكون أكبر من صفر."],
    max: [LIMITS.maxPricePiasters, "السعر أكبر من الحد المسموح."],
    validate: integerValidator,
  },
  compareAtPrice: {
    type: Number,
    validate: [
      integerValidator,
      {
        validator(this: ProductVariant, value: number | null | undefined) {
          return value === undefined || value === null || value > this.price;
        },
        message: "السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي.",
      },
    ],
  },
  stockQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: [0, "الكمية لا يمكن أن تكون سالبة."],
    max: [LIMITS.maxStock, "الكمية أكبر من الحد المسموح."],
    validate: integerValidator,
  },
  lowStockThreshold: {
    type: Number,
    default: 3,
    min: [0, "حد التنبيه لا يمكن أن يكون سالبًا."],
    validate: integerValidator,
  },
  isAvailable: { type: Boolean, default: true },
});

const productSchema = new Schema<Product, ProductModel>(
  {
    name: {
      type: String,
      required: [true, "اسم العطر مطلوب."],
      trim: true,
      minlength: [LIMITS.productName.min, "اسم العطر قصير جدًا."],
      maxlength: [LIMITS.productName.max, "اسم العطر طويل جدًا."],
    },
    slug: {
      type: String,
      required: [true, "الرابط (slug) مطلوب."],
      trim: true,
      match: [SLUG_PATTERN, "الرابط (slug) يحتوي على رموز غير مسموحة."],
    },
    shortDescription: {
      type: String,
      required: [true, "الوصف المختصر مطلوب."],
      trim: true,
      maxlength: [LIMITS.shortDescription.max, "الوصف المختصر طويل جدًا."],
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [LIMITS.description.max, "الوصف التفصيلي طويل جدًا."],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "التصنيف مطلوب."],
    },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", required: [true, "الماركة مطلوبة."] },
    images: {
      type: [imageSchema],
      default: [],
      validate: {
        validator: (images: ProductImage[]) => images.length <= LIMITS.imagesPerProduct,
        message: `الحد الأقصى ${LIMITS.imagesPerProduct} صورة للمنتج.`,
      },
    },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (variants: ProductVariant[]) =>
          variants.length >= LIMITS.variantsPerProduct.min &&
          variants.length <= LIMITS.variantsPerProduct.max,
        message: `يجب أن يكون للعطر من ${LIMITS.variantsPerProduct.min} إلى ${LIMITS.variantsPerProduct.max} أحجام.`,
      },
    },
    isPublished: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    hideFromOffers: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, validate: integerValidator },
    seo: {
      title: { type: String, trim: true, maxlength: LIMITS.seoTitle.max },
      description: { type: String, trim: true, maxlength: LIMITS.seoDescription.max },
      ogImagePublicId: { type: String, trim: true },
    },
    minPrice: { type: Number, default: 0 },
    inStock: { type: Boolean, default: false },
    searchText: { type: String, default: "" },
  },
  { timestamps: true },
);

/**
 * يحسب الحقول المشتقة ويطبق قواعد لا يمكن التعبير عنها بحقل واحد:
 * تفرد الحجم و SKU داخل المنتج، وشروط النشر.
 */
productSchema.pre("validate", function () {
  const sizes = new Set<number>();
  const skus = new Set<string>();
  this.variants.forEach((variant, index) => {
    if (sizes.has(variant.sizeMl)) {
      this.invalidate(`variants.${index}.sizeMl`, "هذا الحجم مكرر في نفس العطر.");
    }
    sizes.add(variant.sizeMl);
    if (variant.sku) {
      if (skus.has(variant.sku)) {
        this.invalidate(`variants.${index}.sku`, "رمز SKU مكرر في نفس العطر.");
      }
      skus.add(variant.sku);
    }
  });

  const available = this.variants.filter((variant) => variant.isAvailable);
  const priced = available.length > 0 ? available : this.variants;
  this.minPrice = priced.length > 0 ? Math.min(...priced.map((variant) => variant.price)) : 0;
  this.inStock = available.some((variant) => variant.stockQuantity > 0);
  this.isOnSale =
    !this.hideFromOffers &&
    this.variants.some(
      (variant) => variant.compareAtPrice !== undefined && variant.compareAtPrice > variant.price,
    );
  if (!this.searchText) this.searchText = buildSearchText(this.name);

  if (this.isPublished) {
    if (this.images.length === 0) {
      this.invalidate("isPublished", "لا يمكن نشر عطر بدون صورة واحدة على الأقل.");
    }
    if (available.length === 0) {
      this.invalidate("isPublished", "لا يمكن نشر عطر بدون حجم متاح واحد على الأقل.");
    }
  }
});

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index(
  { "variants.sku": 1 },
  { unique: true, partialFilterExpression: { "variants.sku": { $type: "string" } } },
);
productSchema.index({ isPublished: 1, categoryId: 1, sortOrder: 1, createdAt: -1 });
productSchema.index({ isPublished: 1, brandId: 1, createdAt: -1 });
productSchema.index({ isPublished: 1, isFeatured: 1, sortOrder: 1 });
productSchema.index({ isPublished: 1, isOnSale: 1 });
productSchema.index({ isPublished: 1, minPrice: 1 });
productSchema.index({ isPublished: 1, searchText: 1 });
productSchema.index({ "images.publicId": 1 });

export const ProductModel = defineModel<Product, ProductModel>("Product", productSchema);
