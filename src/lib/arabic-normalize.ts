/**
 * تطبيع النص العربي لأغراض البحث والمقارنة فقط — لا يُستخدم لتعديل البيانات الأصلية.
 * القواعد موثقة في docs/decisions/0008-arabic-search.md.
 */

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const EASTERN_ARABIC_INDIC_DIGITS = /[۰-۹]/g;

const LETTER_MAP: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ى": "ي",
  "ئ": "ي",
  "ة": "ه",
  "ؤ": "و",
};
const LETTER_PATTERN = new RegExp(`[${Object.keys(LETTER_MAP).join("")}]`, "g");

/** يحوّل الأرقام العربية الهندية (٠-٩ و۰-۹) إلى أرقام لاتينية. */
export function toLatinDigits(text: string): string {
  return text
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizeArabic(text: string): string {
  return toLatinDigits(text.normalize("NFC"))
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(LETTER_PATTERN, (letter) => LETTER_MAP[letter] ?? letter)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** نص البحث المخزّن في Product.searchText. */
export function buildSearchText(...parts: Array<string | null | undefined>): string {
  return normalizeArabic(parts.filter((part): part is string => Boolean(part)).join(" "));
}

/** يهرّب الرموز الخاصة قبل بناء RegExp من مدخلات المستخدم (منع regex injection). */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
