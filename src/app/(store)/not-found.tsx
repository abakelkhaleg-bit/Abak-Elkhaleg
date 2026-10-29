import type { Metadata } from "next";
import { NotFoundContent } from "@/components/store/not-found-content";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة",
  robots: { index: false, follow: true },
};

/** 404 داخل المتجر: يُعرض ضمن layout المتجر (Header/Footer ببيانات حالية من قاعدة البيانات). */
export default function StoreNotFound() {
  return <NotFoundContent />;
}
