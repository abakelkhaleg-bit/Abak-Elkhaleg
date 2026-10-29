import { toLatinDigits } from "@/lib/arabic-normalize";

/**
 * كل المبالغ تُخزن وتُحسب بالقروش (أعداد صحيحة). هذا الملف هو المكان الوحيد للتحويل
 * من وإلى الجنيه. راجع docs/decisions/0009-money-in-piasters.md.
 */

const PIASTERS_PER_POUND = 100;

/** يحوّل مدخل جنيه ("125.5" أو "١٢٥٫٥٠" أو 125.5) إلى قروش، أو null إن كان غير صالح. */
export function parsePoundsToPiasters(input: string | number): number | null {
  const text = toLatinDigits(String(input))
    .trim()
    .replace(/[٫,]/g, ".")
    .replace(/\s+/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  const piasters = Number(whole) * PIASTERS_PER_POUND + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(piasters) ? piasters : null;
}

export function isValidPiasters(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

const egpFormatter = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** للعرض في الواجهة ورسالة واتساب. */
export function formatEGP(piasters: number): string {
  return egpFormatter.format(piasters / PIASTERS_PER_POUND);
}

/** "125.50" — لـ JSON-LD وحقول النماذج. */
export function piastersToDecimalString(piasters: number): string {
  const sign = piasters < 0 ? "-" : "";
  const abs = Math.abs(piasters);
  const whole = Math.floor(abs / PIASTERS_PER_POUND);
  const fraction = String(abs % PIASTERS_PER_POUND).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/** نسبة الخصم الصحيحة المقرّبة، أو null إن لم يكن هناك خصم منطقي. */
export function discountPercent(price: number, compareAtPrice?: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price || price <= 0) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function multiplyPiasters(unitPrice: number, quantity: number): number {
  const total = unitPrice * quantity;
  if (!Number.isSafeInteger(total)) throw new RangeError("المبلغ خارج النطاق المسموح.");
  return total;
}
