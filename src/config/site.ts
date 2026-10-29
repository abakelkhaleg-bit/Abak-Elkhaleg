/**
 * ثوابت الموقع غير الحساسة. القيم القابلة للإدارة (رقم واتساب، التواصل، SEO الافتراضي)
 * تُقرأ من StoreSettings في قاعدة البيانات وليس من هنا.
 */
export const siteConfig = {
  defaultName: "عطور عبق الخليج",
  defaultDescription:
    "عطور عبق الخليج — عطور شرقية وغربية وعود ومسك وعطور فاخرة للرجال والنساء.",
  locale: "ar_EG",
  language: "ar",
  direction: "rtl",
  currency: "EGP",
  country: "EG",
  brandAssets: {
    logo: { src: "/brand/logo.webp", width: 960, height: 385 },
    placeholder: "/brand/placeholder.webp",
    ogDefault: "/brand/og-default.jpg",
    emblem: { src: "/brand/emblem.webp", width: 560, height: 560 },
  },
} as const;
