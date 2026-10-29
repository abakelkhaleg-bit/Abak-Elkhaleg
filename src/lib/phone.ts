import { toLatinDigits } from "@/lib/arabic-normalize";
import { EGYPT_MOBILE_PATTERN } from "@/lib/validation-rules";

/**
 * يحوّل رقم موبايل مصري بأي صيغة شائعة إلى الصيغة المحلية 01xxxxxxxxx،
 * أو يعيد null إن لم يكن رقمًا صالحًا.
 * أمثلة مقبولة: "010 1234 5678"، "+201012345678"، "00201012345678"، "٠١٠١٢٣٤٥٦٧٨".
 */
export function normalizeEgyptianMobile(input: string): string | null {
  let digits = toLatinDigits(input).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20") && digits.length === 12) digits = digits.slice(2);
  if (/^1[0125]\d{8}$/.test(digits)) digits = `0${digits}`;
  return EGYPT_MOBILE_PATTERN.test(digits) ? digits : null;
}

/** 01012345678 → 201012345678 (صيغة wa.me). */
export function toWhatsAppNumber(localMobile: string): string {
  const normalized = normalizeEgyptianMobile(localMobile);
  if (!normalized) throw new Error("رقم الموبايل المصري غير صالح.");
  return `20${normalized.slice(1)}`;
}
