"use client";

/** يُعرض عند فشل الـRoot Layout نفسه؛ لذلك يحتوي على html/body ويستخدم أنماطًا مضمنة بسيطة. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf6ec",
          color: "#1c1915",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <main role="alert" style={{ padding: 24 }}>
          <h1 style={{ color: "#3e2a17" }}>تعذر تحميل الموقع</h1>
          <p>حدث خطأ غير متوقع. حاول مرة أخرى.</p>
          {error.digest ? (
            <p style={{ fontSize: 12 }}>
              رمز الخطأ: <bdi dir="ltr">{error.digest}</bdi>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "12px 24px",
              background: "#1c1915",
              color: "#fbf6ec",
              border: 0,
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </main>
      </body>
    </html>
  );
}
