import { notFound } from "next/navigation";

/**
 * أي رابط غير معروف يمر عبر layout المتجر (بدل صفحة 404 الثابتة المبنية وقت البناء)،
 * فتظهر القائمة والـFooter ببيانات حالية، مع حالة HTTP 404 حقيقية.
 */
export default function MissingPage(): never {
  notFound();
}
