import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/store/empty-state";
import { pageMetadata } from "@/lib/seo";
import { listActiveBrands } from "@/server/catalog.service";

export const metadata: Metadata = pageMetadata({
  title: "الماركات",
  description: "تصفح العطور حسب الماركة.",
  path: "/brands",
});

export default async function BrandsPage() {
  const brands = await listActiveBrands();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">الماركات</h1>
        <p className="text-muted">اختر الماركة لعرض عطورها.</p>
      </header>
      {brands.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link
                href={`/brands/${brand.slug}`}
                className="flex h-full flex-col items-center gap-3 rounded-lg bg-white p-5 text-center shadow-soft ring-1 ring-sand/60 transition-shadow hover:shadow-lifted"
              >
                {brand.logo ? (
                  <div className="relative h-16 w-full">
                    <Image src={brand.logo.src} alt="" fill sizes="200px" className="object-contain" />
                  </div>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-16 items-center justify-center rounded-full bg-cream text-2xl font-bold text-gold-text"
                  >
                    {brand.name.charAt(0)}
                  </span>
                )}
                <span className="font-bold text-espresso">{brand.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="لا توجد ماركات بعد"
          action={{ href: "/perfumes", label: "تصفح العطور" }}
        />
      )}
    </div>
  );
}
