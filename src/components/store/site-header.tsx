import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { CartLink } from "@/features/cart/cart-count";
import { NavDisclosure } from "@/components/store/nav-disclosure";
import { SearchBox } from "@/components/store/search-box";
import { logger } from "@/lib/logger";
import { listActiveCategories } from "@/server/catalog.service";
import type { CategoryCardData } from "@/types/catalog";

const MAIN_LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/perfumes", label: "جميع العطور" },
  { href: "/offers", label: "العروض" },
  { href: "/brands", label: "الماركات" },
];

async function loadCategories(): Promise<CategoryCardData[]> {
  try {
    return await listActiveCategories();
  } catch (error) {
    logger.error("تعذر تحميل تصنيفات القائمة", { error });
    return [];
  }
}

export async function SiteHeader() {
  const { logo } = siteConfig.brandAssets;
  const categories = await loadCategories();
  const linkClass =
    "rounded-md px-3 py-2 text-sm font-medium text-espresso transition-colors hover:bg-cream hover:text-gold-text";

  return (
    // ثابت أعلى الصفحة من الشاشات المتوسطة فقط؛ على الجوال (صفّان: الشعار والبحث) يأخذ مساحة كبيرة.
    <header className="relative z-40 border-b border-sand/70 bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/85 md:sticky md:top-0">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <NavDisclosure
          className="relative lg:hidden"
          summaryClassName="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-espresso hover:bg-cream [&::-webkit-details-marker]:hidden"
          panelClassName="absolute start-0 top-full z-50 mt-2 max-h-[75dvh] w-72 overflow-y-auto rounded-lg bg-white p-3 shadow-lifted ring-1 ring-sand"
          summary={
            <>
              <span className="sr-only">القائمة</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </>
          }
        >
          <nav aria-label="القائمة الرئيسية للجوال">
            <ul className="flex flex-col">
              {MAIN_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={`block ${linkClass}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            {categories.length > 0 ? (
              <>
                <p className="mt-3 border-t border-sand px-3 pt-3 text-xs font-bold text-muted">
                  التصنيفات
                </p>
                <ul className="flex flex-col">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link href={`/categories/${category.slug}`} className={`block ${linkClass}`}>
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </nav>
        </NavDisclosure>

        <Link
          href="/"
          aria-label={`${siteConfig.defaultName} — الصفحة الرئيسية`}
          className="shrink-0"
        >
          <Image
            src={logo.src}
            alt={siteConfig.defaultName}
            width={logo.width}
            height={logo.height}
            priority
            sizes="160px"
            className="h-12 w-auto sm:h-14"
          />
        </Link>

        <div className="mx-auto hidden w-full max-w-md md:block">
          <SearchBox idPrefix="header" />
        </div>

        <div className="ms-auto md:ms-0">
          <CartLink />
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchBox idPrefix="header-mobile" />
      </div>

      <nav aria-label="القائمة الرئيسية" className="hidden border-t border-sand/60 lg:block">
        <ul className="mx-auto flex max-w-7xl items-center gap-1 px-6 py-1.5 lg:px-8">
          {MAIN_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            </li>
          ))}
          {categories.length > 0 ? (
            <li>
              <NavDisclosure
                className="relative"
                summaryClassName={`${linkClass} flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden`}
                panelClassName="absolute start-0 top-full z-50 mt-1 grid w-80 grid-cols-2 gap-1 rounded-lg bg-white p-3 shadow-lifted ring-1 ring-sand"
                summary={
                  <>
                    التصنيفات
                    <span aria-hidden="true" className="text-xs">
                      ▾
                    </span>
                  </>
                }
              >
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className={linkClass}
                  >
                    {category.name}
                  </Link>
                ))}
              </NavDisclosure>
            </li>
          ) : null}
        </ul>
      </nav>
    </header>
  );
}
