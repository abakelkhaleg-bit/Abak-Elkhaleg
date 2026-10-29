import Link from "next/link";

/** محتوى صفحة 404 — مشترك بين صفحة المتجر والصفحة الجذرية. */
export function NotFoundContent() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-6xl font-extrabold text-gold">٤٠٤</p>
        <h1 className="text-2xl">الصفحة غير موجودة</h1>
        <p className="text-muted">ربما تغيّر الرابط أو لم تعد الصفحة متاحة.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-md bg-charcoal px-6 py-3 font-medium text-ivory transition-colors hover:bg-espresso"
          >
            العودة إلى الصفحة الرئيسية
          </Link>
          <Link
            href="/perfumes"
            className="rounded-md border border-sand px-6 py-3 font-medium transition-colors hover:border-gold"
          >
            تصفح العطور
          </Link>
        </div>
      </div>
    </div>
  );
}
