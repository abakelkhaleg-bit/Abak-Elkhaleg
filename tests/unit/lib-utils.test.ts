import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  escapeRegExp,
  normalizeArabic,
  toLatinDigits,
} from "@/lib/arabic-normalize";
import {
  discountPercent,
  formatEGP,
  multiplyPiasters,
  parsePoundsToPiasters,
  piastersToDecimalString,
} from "@/lib/money";
import { normalizeEgyptianMobile, toWhatsAppNumber } from "@/lib/phone";
import { isValidSlug, slugify } from "@/lib/slug";

describe("normalizeArabic", () => {
  it.each([
    ["إِطْلَالَة", "اطلاله"],
    ["عـــود", "عود"],
    ["مسكى", "مسكي"],
    ["آسر", "اسر"],
    ["لؤلؤة", "لولوه"],
    ["  عطر   فاخر  ", "عطر فاخر"],
    ["Oud ROYAL ١٠٠", "oud royal 100"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeArabic(input)).toBe(expected);
  });

  it("يجعل الكلمات المتشابهة متطابقة دون تعديل الأصل", () => {
    const original = "إطلالة";
    expect(normalizeArabic(original)).toBe(normalizeArabic("اطلاله"));
    expect(original).toBe("إطلالة");
  });

  it("buildSearchText يجمع الأجزاء ويتجاهل الفارغ", () => {
    expect(buildSearchText("عود ملكي", undefined, "دار العود", "")).toBe("عود ملكي دار العود");
  });

  it("escapeRegExp يمنع حقن التعابير النمطية", () => {
    const pattern = new RegExp(escapeRegExp("a.*(b"));
    expect(pattern.test("a.*(b")).toBe(true);
    expect(pattern.test("aXXb")).toBe(false);
  });

  it("toLatinDigits يحول الأرقام الهندية بنوعيها", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲")).toBe("0123456789 012");
  });
});

describe("slugify", () => {
  it.each([
    ["عطور رجالي", "عطور-رجالي"],
    ["عُود  مَلَكي!!", "عود-ملكي"],
    ["Oud Royal 100ml", "oud-royal-100ml"],
    ["مسك ١٠٠", "مسك-100"],
    ["--- عطر ---", "عطر"],
  ])("%s → %s", (input, expected) => {
    const slug = slugify(input);
    expect(slug).toBe(expected);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("يرفض slug بمسافات أو رموز", () => {
    expect(isValidSlug("عطر رجالي")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
    expect(isValidSlug("-a")).toBe(false);
    expect(isValidSlug("A")).toBe(false);
  });
});

describe("money (قروش)", () => {
  it.each([
    ["125", 12_500],
    ["125.5", 12_550],
    ["125.05", 12_505],
    ["١٢٥٫٥٠", 12_550],
    [99.99, 9_999],
    ["0", 0],
  ])("parsePoundsToPiasters(%s) = %i", (input, expected) => {
    expect(parsePoundsToPiasters(input)).toBe(expected);
  });

  it.each(["-5", "1.234", "abc", "", "1e3", "12.5.0"])("يرفض %s", (input) => {
    expect(parsePoundsToPiasters(input)).toBeNull();
  });

  it("لا أخطاء كسور عشرية في الجمع", () => {
    const total = [10, 20]
      .map((n) => parsePoundsToPiasters(`0.${n}`) ?? 0)
      .reduce((a, b) => a + b);
    expect(total).toBe(30);
    expect(piastersToDecimalString(total)).toBe("0.30");
  });

  it("piastersToDecimalString لـ JSON-LD", () => {
    expect(piastersToDecimalString(12_550)).toBe("125.50");
    expect(piastersToDecimalString(5)).toBe("0.05");
  });

  it("formatEGP يستخدم العربية والجنيه", () => {
    const formatted = formatEGP(125_050);
    expect(formatted).toMatch(/ج\.م\.?|EGP/);
    expect(formatted).toContain("١٬٢٥٠٫٥");
  });

  it("discountPercent", () => {
    expect(discountPercent(95_000, 120_000)).toBe(21);
    expect(discountPercent(100, 100)).toBeNull();
    expect(discountPercent(100, 50)).toBeNull();
    expect(discountPercent(100, undefined)).toBeNull();
  });

  it("multiplyPiasters يرفض التجاوز", () => {
    expect(multiplyPiasters(54_950, 3)).toBe(164_850);
    expect(() => multiplyPiasters(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });
});

describe("phone (مصر)", () => {
  it.each([
    ["01012345678", "01012345678"],
    ["010 1234 5678", "01012345678"],
    ["+201112345678", "01112345678"],
    ["00201212345678", "01212345678"],
    ["201512345678", "01512345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "01012345678"],
  ])("normalizeEgyptianMobile(%s)", (input, expected) => {
    expect(normalizeEgyptianMobile(input)).toBe(expected);
  });

  it.each(["01312345678", "0101234567", "12345", "0221234567", ""])("يرفض %s", (input) => {
    expect(normalizeEgyptianMobile(input)).toBeNull();
  });

  it("toWhatsAppNumber يعطي صيغة wa.me", () => {
    expect(toWhatsAppNumber("01012345678")).toBe("201012345678");
    expect(() => toWhatsAppNumber("123")).toThrow();
  });
});
