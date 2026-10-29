import { z } from "zod";
import { LIMITS, SKU_PATTERN } from "@/lib/validation-rules";
import {
  imageRefSchema,
  objectIdSchema,
  optionalTrimmed,
  piastersSchema,
  seoInputSchema,
  slugSchema,
  sortOrderSchema,
} from "@/schemas/common";

/**
 * مدخلات إنشاء/تعديل المنتج من لوحة الإدارة (المبالغ بالقروش — التحويل من الجنيه يتم
 * في طبقة النموذج عبر poundsInputSchema). نفس القواعد مفروضة أيضًا في نموذج Mongoose.
 */

export const variantInputSchema = z
  .object({
    id: objectIdSchema.optional(),
    sizeMl: z
      .int("الحجم يجب أن يكون عددًا صحيحًا.")
      .min(LIMITS.sizeMl.min, "الحجم غير صالح.")
      .max(LIMITS.sizeMl.max, "الحجم غير صالح."),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((value) => (value === "" ? undefined : value))
      .refine((value) => value === undefined || SKU_PATTERN.test(value), {
        message: "رمز SKU يجب أن يتكون من حروف إنجليزية كبيرة وأرقام وشرطات (3–40).",
      }),
    price: piastersSchema.min(1, "السعر يجب أن يكون أكبر من صفر."),
    compareAtPrice: piastersSchema.optional(),
    /** الكمية الأولية عند الإنشاء فقط؛ التعديل لاحقًا عبر إدارة المخزون (يُسجَّل كحركة). */
    initialStock: z.int().min(0, "الكمية لا يمكن أن تكون سالبة.").max(LIMITS.maxStock).default(0),
    lowStockThreshold: z.int().min(0, "حد التنبيه لا يمكن أن يكون سالبًا.").default(3),
    isAvailable: z.boolean().default(true),
  })
  .refine(
    (variant) => variant.compareAtPrice === undefined || variant.compareAtPrice > variant.price,
    { path: ["compareAtPrice"], message: "السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي." },
  );

export const productInputSchema = z
  .object({
    name: z
      .string({ error: "اسم العطر مطلوب." })
      .trim()
      .min(LIMITS.productName.min, "اسم العطر قصير جدًا.")
      .max(LIMITS.productName.max, "اسم العطر طويل جدًا."),
    slug: slugSchema.optional(),
    shortDescription: z
      .string({ error: "الوصف المختصر مطلوب." })
      .trim()
      .min(1, "الوصف المختصر مطلوب.")
      .max(LIMITS.shortDescription.max, "الوصف المختصر طويل جدًا."),
    description: optionalTrimmed(LIMITS.description.max, "الوصف التفصيلي طويل جدًا."),
    categoryId: objectIdSchema,
    brandId: objectIdSchema,
    images: z
      .array(imageRefSchema)
      .max(LIMITS.imagesPerProduct, `الحد الأقصى ${LIMITS.imagesPerProduct} صورة.`)
      .default([]),
    variants: z
      .array(variantInputSchema)
      .min(LIMITS.variantsPerProduct.min, "أضف حجمًا واحدًا على الأقل.")
      .max(LIMITS.variantsPerProduct.max, `الحد الأقصى ${LIMITS.variantsPerProduct.max} أحجام.`),
    isPublished: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    hideFromOffers: z.boolean().default(false),
    sortOrder: sortOrderSchema,
    seo: seoInputSchema,
  })
  .superRefine((product, ctx) => {
    const sizes = new Set<number>();
    const skus = new Set<string>();
    product.variants.forEach((variant, index) => {
      if (sizes.has(variant.sizeMl)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "sizeMl"],
          message: "هذا الحجم مكرر في نفس العطر.",
        });
      }
      sizes.add(variant.sizeMl);
      if (variant.sku) {
        if (skus.has(variant.sku)) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", index, "sku"],
            message: "رمز SKU مكرر في نفس العطر.",
          });
        }
        skus.add(variant.sku);
      }
    });

    if (product.isPublished) {
      if (product.images.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["isPublished"],
          message: "لا يمكن نشر عطر بدون صورة واحدة على الأقل.",
        });
      }
      if (!product.variants.some((variant) => variant.isAvailable)) {
        ctx.addIssue({
          code: "custom",
          path: ["isPublished"],
          message: "لا يمكن نشر عطر بدون حجم متاح واحد على الأقل.",
        });
      }
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
