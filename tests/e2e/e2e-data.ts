/**
 * ثوابت بيانات اختبارات E2E. ملف بلا أي استيرادات حتى تستخدمه ملفات الاختبار (عملية Playwright)
 * دون تحميل وحدات الخادم (server-only). البيانات نفسها تُنشأ في seed-e2e.ts.
 */
export const E2E = {
  draftSlug: "draft-e2e",
  hiddenCategorySlug: "hidden-e2e",
  bulkCategorySlug: "e2e-bulk",
  bulkCount: 22,
  policy: { slug: "shipping", title: "سياسة الشحن" },
  adminDraft: { slug: "admin-draft-e2e", name: "مسودة للنشر من الإدارة" },
  /** بيانات دخول للاختبار فقط — تُنشأ في قاعدة الذاكرة المؤقتة ولا تُستخدم في أي بيئة أخرى. */
  admin: { username: "e2e-admin", password: "E2E-only-Passw0rd-local" },
} as const;
