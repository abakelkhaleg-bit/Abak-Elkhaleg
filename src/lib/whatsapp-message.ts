import { governorateName } from "@/config/governorates";
import { formatEGP } from "@/lib/money";
import { toWhatsAppNumber } from "@/lib/phone";

/**
 * رسالة طلب واتساب ورابطها. دوال نقية (بلا قاعدة بيانات) لتُختبر مباشرة (W5–W7).
 * كل القيم هنا محسوبة على الخادم؛ لا شيء يأتي من المتصفح إلا بيانات العميل.
 */

export type OrderMessageInput = {
  reference: string;
  storeName: string;
  items: Array<{ productName: string; sizeMl: number; quantity: number; unitPrice: number; lineTotal: number }>;
  total: number;
  customer: { name: string; phone: string; governorate: string; address?: string; notes?: string };
};

const arabicNumber = new Intl.NumberFormat("ar-EG");

export function buildOrderMessage(order: OrderMessageInput): string {
  const lines = [
    `مرحبًا ${order.storeName}، أريد طلب:`,
    `رقم الطلب: ${order.reference}`,
    "",
    ...order.items.flatMap((item, index) => [
      `${arabicNumber.format(index + 1)}. ${item.productName} — ${arabicNumber.format(item.sizeMl)} مل`,
      `   الكمية: ${arabicNumber.format(item.quantity)} × ${formatEGP(item.unitPrice)} = ${formatEGP(item.lineTotal)}`,
    ]),
    "",
    `الإجمالي: ${formatEGP(order.total)} (غير شامل التوصيل)`,
    "",
    `الاسم: ${order.customer.name}`,
    `الموبايل: ${order.customer.phone}`,
    `المحافظة: ${governorateName(order.customer.governorate) ?? order.customer.governorate}`,
  ];
  if (order.customer.address) lines.push(`العنوان: ${order.customer.address}`);
  if (order.customer.notes) lines.push(`ملاحظات: ${order.customer.notes}`);
  return lines.join("\n");
}

/** https://wa.me/20XXXXXXXXXX?text=… — الرقم من إعدادات المتجر بالصيغة الدولية بلا "+". */
export function buildWhatsAppUrl(storeMobile: string, message: string): string {
  return `https://wa.me/${toWhatsAppNumber(storeMobile)}?text=${encodeURIComponent(message)}`;
}
