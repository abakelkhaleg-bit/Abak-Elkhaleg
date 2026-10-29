import { z } from "zod";
import { GOVERNORATE_IDS } from "@/config/governorates";
import { normalizeEgyptianMobile } from "@/lib/phone";
import { LIMITS } from "@/lib/validation-rules";
import { objectIdSchema, optionalTrimmed } from "@/schemas/common";

/**
 * مدخلات السلة والطلب من المتصفح. لا تحتوي أي سعر أو إجمالي: أي حقول إضافية
 * يرسلها العميل (مثل price أو total) تُحذف، والخادم يعيد الحساب من قاعدة البيانات.
 */

export const cartItemSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema,
  quantity: z
    .int("الكمية يجب أن تكون عددًا صحيحًا.")
    .min(1, "الكمية يجب أن تكون 1 على الأقل.")
    .max(LIMITS.orderItemQuantity.max, `الحد الأقصى ${LIMITS.orderItemQuantity.max} لكل عطر.`),
});

export const cartItemsSchema = z
  .array(cartItemSchema)
  .min(1, "السلة فارغة.")
  .max(LIMITS.orderItems.max, `الحد الأقصى ${LIMITS.orderItems.max} بندًا في الطلب.`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = `${item.productId}:${item.variantId}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: [index], message: "نفس الحجم مكرر في السلة." });
      }
      seen.add(key);
    });
  });

export const egyptianMobileSchema = z
  .string({ error: "رقم الموبايل مطلوب." })
  .transform((value, ctx) => {
    const normalized = normalizeEgyptianMobile(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "أدخل رقم موبايل مصري صحيح (مثال: 01012345678)." });
      return z.NEVER;
    }
    return normalized;
  });

export const customerInputSchema = z.object({
  name: z
    .string({ error: "الاسم مطلوب." })
    .trim()
    .min(LIMITS.customerName.min, "الاسم قصير جدًا.")
    .max(LIMITS.customerName.max, "الاسم طويل جدًا."),
  phone: egyptianMobileSchema,
  governorate: z.enum(GOVERNORATE_IDS, { error: "اختر المحافظة من القائمة." }),
  address: optionalTrimmed(LIMITS.customerAddress.max, "العنوان طويل جدًا."),
  notes: optionalTrimmed(LIMITS.customerNotes.max, "الملاحظات طويلة جدًا."),
});

export const createOrderInputSchema = z.object({
  items: cartItemsSchema,
  customer: customerInputSchema,
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
