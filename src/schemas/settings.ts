import { z } from "zod";
import { normalizeEgyptianMobile, toWhatsAppNumber } from "@/lib/phone";
import { LIMITS } from "@/lib/validation-rules";
import { imageRefSchema, optionalTrimmed, seoInputSchema, slugSchema } from "@/schemas/common";

/** مدخلات إعدادات المتجر من لوحة الإدارة. */

const optionalHttpsUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine((value) => value === undefined || /^https:\/\/[^\s]+$/.test(value), {
    message: "الرابط يجب أن يبدأ بـ https://",
  });

/** يُدخل الأدمن الرقم بصيغة مصرية، ويُخزن بصيغة wa.me (201xxxxxxxxx). */
export const whatsappNumberInputSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    if (!normalizeEgyptianMobile(value)) {
      ctx.addIssue({ code: "custom", message: "أدخل رقم واتساب مصري صحيح (مثال: 01012345678)." });
      return z.NEVER;
    }
    return toWhatsAppNumber(value);
  });

export const storeSettingsInputSchema = z.object({
  storeName: z.string().trim().min(2, "اسم المتجر قصير جدًا.").max(80, "اسم المتجر طويل جدًا."),
  logo: imageRefSchema.optional(),
  whatsappNumber: whatsappNumberInputSchema,
  contact: z
    .object({
      phone: optionalTrimmed(30),
      email: z
        .string()
        .trim()
        .optional()
        .transform((value) => (value === "" ? undefined : value))
        .pipe(z.email("البريد الإلكتروني غير صالح.").optional()),
      address: optionalTrimmed(300),
      workingHours: optionalTrimmed(120),
    })
    .prefault({}),
  description: optionalTrimmed(LIMITS.storeDescription.max, "الوصف طويل جدًا."),
  defaultSeo: seoInputSchema,
  socialLinks: z
    .object({
      instagram: optionalHttpsUrl,
      facebook: optionalHttpsUrl,
      tiktok: optionalHttpsUrl,
      x: optionalHttpsUrl,
      snapchat: optionalHttpsUrl,
    })
    .prefault({}),
  homepage: z
    .object({
      heroTitle: optionalTrimmed(120, "العنوان طويل جدًا."),
      heroSubtitle: optionalTrimmed(300, "النص طويل جدًا."),
    })
    .prefault({}),
  policies: z
    .array(
      z.object({
        slug: slugSchema,
        title: z.string().trim().min(2, "عنوان الصفحة قصير جدًا.").max(80, "عنوان الصفحة طويل جدًا."),
        body: z
          .string()
          .trim()
          .min(10, "محتوى الصفحة قصير جدًا.")
          .max(LIMITS.policyBody.max, "محتوى الصفحة طويل جدًا."),
      }),
    )
    .max(10, "الحد الأقصى 10 صفحات.")
    .default([])
    .superRefine((policies, ctx) => {
      const seen = new Set<string>();
      policies.forEach((policy, index) => {
        if (seen.has(policy.slug)) {
          ctx.addIssue({ code: "custom", path: [index, "slug"], message: "رابط الصفحة مكرر." });
        }
        seen.add(policy.slug);
      });
    }),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsInputSchema>;
