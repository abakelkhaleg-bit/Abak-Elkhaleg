"use client";

import Link from "next/link";
import { useEffect } from "react";

/** خطأ داخل صفحات المتجر — يبقى الـHeader والـFooter ظاهرين. */
export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("خطأ في صفحة المتجر", error.digest);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center"
    >
      <h1 className="text-2xl">تعذر تحميل الصفحة</h1>
      <p className="text-muted">
        قد يكون هناك انقطاع مؤقت في الاتصال بالخادم. حاول مرة أخرى بعد لحظات.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted">
          رمز الخطأ: <bdi dir="ltr">{error.digest}</bdi>
        </p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-charcoal px-6 py-3 font-medium text-ivory transition-colors hover:bg-espresso"
        >
          إعادة المحاولة
        </button>
        <Link
          href="/"
          className="rounded-md border border-sand px-6 py-3 font-medium hover:border-gold"
        >
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
