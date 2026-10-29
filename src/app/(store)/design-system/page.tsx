import type { Metadata } from "next";
import { notFound } from "next/navigation";

/** صفحة مرجعية لـ Design Tokens — متاحة في التطوير فقط، وتعيد 404 في الإنتاج. */

export const metadata: Metadata = {
  title: "نظام التصميم",
  robots: { index: false, follow: false },
};

const colors = [
  { token: "ivory", hex: "#FBF6EC", use: "الخلفية الرئيسية" },
  { token: "cream", hex: "#F3EAD8", use: "البطاقات والأقسام" },
  { token: "sand", hex: "#E6D7B8", use: "الحدود" },
  { token: "charcoal", hex: "#1C1915", use: "النص والأزرار الأساسية" },
  { token: "espresso", hex: "#3E2A17", use: "العناوين والفوتر" },
  { token: "gold", hex: "#B8862F", use: "الإبراز والأيقونات" },
  { token: "gold-text", hex: "#8A6420", use: "نص ذهبي (تباين AA)" },
  { token: "muted", hex: "#6B5F50", use: "نص ثانوي" },
  { token: "success", hex: "#256B42", use: "النجاح" },
  { token: "warning", hex: "#8F5600", use: "التحذير" },
  { token: "danger", hex: "#B3261E", use: "الخطأ" },
] as const;

const swatchClass: Record<(typeof colors)[number]["token"], string> = {
  ivory: "bg-ivory",
  cream: "bg-cream",
  sand: "bg-sand",
  charcoal: "bg-charcoal",
  espresso: "bg-espresso",
  gold: "bg-gold",
  "gold-text": "bg-gold-text",
  muted: "bg-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const sampleAmount = new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(
  1250.5,
);

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">نظام التصميم</h1>
        <p className="text-muted">مرجع الألوان والخطوط والمكونات الأساسية. (التطوير فقط)</p>
      </header>

      <section aria-labelledby="colors-heading" className="flex flex-col gap-4">
        <h2 id="colors-heading" className="text-xl">
          الألوان
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {colors.map((color) => (
            <li key={color.token} className="overflow-hidden rounded-lg bg-white shadow-soft">
              <div className={`h-16 ${swatchClass[color.token]} border-b border-sand`} />
              <div className="flex flex-col gap-1 p-3 text-sm">
                <span className="font-bold">{color.token}</span>
                <bdi dir="ltr" className="text-start text-muted">
                  {color.hex}
                </bdi>
                <span className="text-muted">{color.use}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type-heading" className="flex flex-col gap-3">
        <h2 id="type-heading" className="text-xl">
          الخطوط — Tajawal
        </h2>
        <p className="text-4xl font-extrabold">عطور عبق الخليج</p>
        <p className="text-2xl font-bold">عود ملكي فاخر</p>
        <p className="text-lg font-medium">مسك أبيض ناعم بلمسة زهرية</p>
        <p className="text-base">نص أساسي: عطر شرقي يجمع العود والعنبر والورد الطائفي.</p>
        <p className="text-sm text-muted">نص ثانوي صغير</p>
        <p className="text-lg">
          تنسيق السعر: <bdi>{sampleAmount}</bdi>
        </p>
      </section>

      <section aria-labelledby="buttons-heading" className="flex flex-col gap-4">
        <h2 id="buttons-heading" className="text-xl">
          الأزرار والحالات
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md bg-charcoal px-5 py-2.5 font-medium text-ivory transition-colors hover:bg-espresso"
          >
            زر أساسي
          </button>
          <button
            type="button"
            className="rounded-md border border-gold px-5 py-2.5 font-medium text-gold-text transition-colors hover:bg-cream"
          >
            زر ثانوي
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md bg-charcoal/40 px-5 py-2.5 font-medium text-ivory"
          >
            زر معطل
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <p className="rounded-md bg-success-soft px-4 py-3 text-success">تمت العملية بنجاح</p>
          <p className="rounded-md bg-warning-soft px-4 py-3 text-warning">المخزون منخفض</p>
          <p className="rounded-md bg-danger-soft px-4 py-3 text-danger">تعذر حفظ التغييرات</p>
        </div>
      </section>
    </div>
  );
}
