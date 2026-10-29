import { z } from "zod";
import { parsePoundsToPiasters } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { CLOUDINARY_URL_PATTERN, LIMITS, SLUG_PATTERN } from "@/lib/validation-rules";

/** مخططات Zod مشتركة. تُستخدم على الخادم دائمًا، وعلى العميل لتحسين تجربة النماذج فقط. */

export const objectIdSchema = z
  .string({ error: "المعرّف مطلوب." })
  .regex(/^[a-f0-9]{24}$/i, "المعرّف غير صالح.");

export const slugSchema = z
  .string({ error: "الرابط (slug) مطلوب." })
  .trim()
  .min(1, "الرابط (slug) مطلوب.")
  .max(96, "الرابط (slug) طويل جدًا.")
  .regex(SLUG_PATTERN, "الرابط (slug) يحتوي على رموز غير مسموحة.");

/** slug اختياري في النماذج: إن تُرك فارغًا يُقترح من الاسم. */
export function withSlugFallback<T extends { name: string; slug?: string | undefined }>(
  value: T,
): T & { slug: string } {
  return { ...value, slug: value.slug && value.slug.length > 0 ? value.slug : slugify(value.name) };
}

export const optionalTrimmed = (max: number, message = "النص طويل جدًا.") =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

/** مبلغ بالقروش (عدد صحيح). */
export const piastersSchema = z
  .int({ error: "المبلغ يجب أن يكون عددًا صحيحًا بالقروش." })
  .min(0, "المبلغ لا يمكن أن يكون سالبًا.")
  .max(LIMITS.maxPricePiasters, "المبلغ أكبر من الحد المسموح.");

/** مدخل جنيه من نموذج ("125.50" أو 125.5) يُحوَّل إلى قروش. */
export const poundsInputSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const piasters = parsePoundsToPiasters(value);
    if (piasters === null) {
      ctx.addIssue({ code: "custom", message: "أدخل مبلغًا صحيحًا بحد أقصى رقمين عشريين." });
      return z.NEVER;
    }
    return piasters;
  })
  .pipe(piastersSchema);

export const imageRefSchema = z.object({
  secureUrl: z
    .string()
    .regex(CLOUDINARY_URL_PATTERN, "رابط الصورة يجب أن يكون من Cloudinary (https)."),
  publicId: z.string().trim().min(1, "معرّف الصورة مطلوب."),
  altText: z.string().trim().max(LIMITS.altText.max, "النص البديل طويل جدًا.").default(""),
});

export const seoInputSchema = z
  .object({
    title: optionalTrimmed(LIMITS.seoTitle.max, `عنوان SEO بحد أقصى ${LIMITS.seoTitle.max} حرفًا.`),
    description: optionalTrimmed(
      LIMITS.seoDescription.max,
      `وصف SEO بحد أقصى ${LIMITS.seoDescription.max} حرفًا.`,
    ),
  })
  .prefault({});

export const sortOrderSchema = z
  .int("الترتيب يجب أن يكون عددًا صحيحًا.")
  .min(0, "الترتيب لا يمكن أن يكون سالبًا.")
  .max(100_000)
  .default(0);
