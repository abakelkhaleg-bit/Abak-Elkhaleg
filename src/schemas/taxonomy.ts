import { z } from "zod";
import { LIMITS } from "@/lib/validation-rules";
import {
  imageRefSchema,
  optionalTrimmed,
  seoInputSchema,
  slugSchema,
  sortOrderSchema,
} from "@/schemas/common";

/** مدخلات التصنيفات والماركات من لوحة الإدارة. */

const taxonomyBase = {
  slug: slugSchema.optional(),
  description: optionalTrimmed(LIMITS.taxonomyDescription.max, "الوصف طويل جدًا."),
  isActive: z.boolean().default(true),
  sortOrder: sortOrderSchema,
  seo: seoInputSchema,
};

export const categoryInputSchema = z.object({
  name: z
    .string({ error: "اسم التصنيف مطلوب." })
    .trim()
    .min(LIMITS.categoryName.min, "اسم التصنيف قصير جدًا.")
    .max(LIMITS.categoryName.max, "اسم التصنيف طويل جدًا."),
  image: imageRefSchema.optional(),
  ...taxonomyBase,
});

export const brandInputSchema = z.object({
  name: z
    .string({ error: "اسم الماركة مطلوب." })
    .trim()
    .min(LIMITS.brandName.min, "اسم الماركة قصير جدًا.")
    .max(LIMITS.brandName.max, "اسم الماركة طويل جدًا."),
  logo: imageRefSchema.optional(),
  ...taxonomyBase,
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type BrandInput = z.infer<typeof brandInputSchema>;
