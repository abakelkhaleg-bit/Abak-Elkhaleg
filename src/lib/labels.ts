import type { MovementType } from "@/lib/validation-rules";

/** تسميات عربية موحدة لقيم النظام (تُعرض في لوحة الإدارة). */
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  initial: "كمية أولية",
  restock: "توريد",
  adjustment: "تعديل",
  stocktake: "تصحيح جرد",
  sale: "بيع (طلب مؤكد)",
  order_cancel_restore: "إرجاع (إلغاء طلب)",
};

export function movementLabel(type: string): string {
  return type in MOVEMENT_TYPE_LABELS ? MOVEMENT_TYPE_LABELS[type as MovementType] : type;
}
