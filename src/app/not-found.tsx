import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NotFoundContent } from "@/components/store/not-found-content";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة",
  robots: { index: false, follow: true },
};

/**
 * 404 خارج مسارات المتجر (روابط المتجر غير المعروفة تمر عبر (store)/[...missing]).
 * صفحة ثابتة تُبنى وقت البناء — لا تقرأ من قاعدة البيانات.
 */
export default function NotFound() {
  const { logo } = siteConfig.brandAssets;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-sand/70 bg-ivory px-4 py-3">
        <Link href="/" aria-label={`${siteConfig.defaultName} — الصفحة الرئيسية`} className="block w-fit">
          <Image
            src={logo.src}
            alt={siteConfig.defaultName}
            width={logo.width}
            height={logo.height}
            sizes="160px"
            className="h-12 w-auto"
          />
        </Link>
      </header>
      <main id="main-content" className="flex flex-1 flex-col">
        <NotFoundContent />
      </main>
    </div>
  );
}
