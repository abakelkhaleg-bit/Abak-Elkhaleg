import { toLatinDigits } from "@/lib/arabic-normalize";
import { SLUG_PATTERN } from "@/lib/validation-rules";

const TASHKEEL_AND_TATWEEL = /[ؐ-ًؚ-ٰٟـ]/g;
const NOT_SLUG_CHAR = /[^a-z0-9ء-غف-ي]+/g;

/**
 * يقترح slug من اسم عربي أو لاتيني: يحذف التشكيل والتطويل، يحوّل الأرقام إلى لاتينية،
 * ويستبدل أي فاصل بشرطة واحدة. الحروف العربية تبقى كما هي (روابط عربية مقروءة).
 */
export function slugify(input: string): string {
  return toLatinDigits(input.normalize("NFC"))
    .toLowerCase()
    .replace(TASHKEEL_AND_TATWEEL, "")
    .replace(NOT_SLUG_CHAR, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96)
    .replace(/-$/, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
