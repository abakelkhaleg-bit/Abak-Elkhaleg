import type { Metadata } from "next";

/** كل صفحات الإدارة: لا فهرسة (إضافة إلى X-Robots-Tag في next.config). */
export const metadata: Metadata = {
  title: { default: "لوحة الإدارة", template: "%s | لوحة الإدارة" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-cream/40">{children}</div>;
}
