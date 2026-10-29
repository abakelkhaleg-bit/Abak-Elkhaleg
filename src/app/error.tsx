"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // التفاصيل تُسجل على الخادم؛ هنا نكتفي بالرمز المرجعي.
    console.error("خطأ في الصفحة", error.digest);
  }, [error]);

  return (
    <main
      id="main-content"
      className="flex min-h-[60dvh] items-center justify-center px-4 py-24"
      role="alert"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-2xl">حدث خطأ غير متوقع</h1>
        <p className="text-muted">نعتذر عن ذلك. حاول مرة أخرى بعد لحظات.</p>
        {error.digest ? (
          <p className="text-xs text-muted">
            رمز الخطأ: <bdi dir="ltr">{error.digest}</bdi>
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-md bg-charcoal px-6 py-3 font-medium text-ivory transition-colors hover:bg-espresso"
        >
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
