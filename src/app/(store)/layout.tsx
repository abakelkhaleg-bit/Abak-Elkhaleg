import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";

/**
 * صفحات المتجر تقرأ من قاعدة البيانات عند كل طلب (الأسعار والتوفر يجب أن تكون حالية).
 * الكاش بالوسوم مع إعادة التحقق عند تعديل الإدارة يُضاف في المرحلة 4.
 */
export const dynamic = "force-dynamic";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-charcoal focus:px-4 focus:py-2 focus:text-ivory"
      >
        تخطَّ إلى المحتوى
      </a>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
