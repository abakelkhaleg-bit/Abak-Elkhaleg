import { z } from "zod";
import { LIMITS } from "@/lib/validation-rules";
import { objectIdSchema } from "@/schemas/common";

/** عمليات المخزون اليدوية من لوحة الإدارة. كلها تُسجَّل كحركة في InventoryMovement. */

const target = {
  productId: objectIdSchema,
  variantId: objectIdSchema,
};

const reasonSchema = z
  .string({ error: "سبب التعديل مطلوب." })
  .trim()
  .min(LIMITS.movementReason.min, "سبب التعديل قصير جدًا.")
  .max(LIMITS.movementReason.max, "سبب التعديل طويل جدًا.");

export const stockOperationSchema = z.discriminatedUnion("type", [
  /** إضافة كمية جديدة (توريد). */
  z.object({
    type: z.literal("restock"),
    ...target,
    quantity: z.int("الكمية يجب أن تكون عددًا صحيحًا.").min(1, "أدخل كمية أكبر من صفر.").max(LIMITS.maxStock),
    reason: reasonSchema.optional(),
  }),
  /** تعديل بالزيادة أو النقص مع سبب (تالف، هدية، خطأ إدخال…). */
  z.object({
    type: z.literal("adjustment"),
    ...target,
    delta: z
      .int("التغيير يجب أن يكون عددًا صحيحًا.")
      .min(-LIMITS.maxStock)
      .max(LIMITS.maxStock)
      .refine((delta) => delta !== 0, "التغيير لا يمكن أن يكون صفرًا."),
    reason: reasonSchema,
  }),
  /** تصحيح جرد: تعيين الكمية الفعلية المعدودة. */
  z.object({
    type: z.literal("stocktake"),
    ...target,
    newQuantity: z.int("الكمية يجب أن تكون عددًا صحيحًا.").min(0, "الكمية لا يمكن أن تكون سالبة.").max(LIMITS.maxStock),
    reason: reasonSchema,
  }),
]);

export const lowStockThresholdSchema = z.object({
  ...target,
  lowStockThreshold: z.int("حد التنبيه يجب أن يكون عددًا صحيحًا.").min(0, "حد التنبيه لا يمكن أن يكون سالبًا.").max(LIMITS.maxStock),
});

export type StockOperationInput = z.infer<typeof stockOperationSchema>;
