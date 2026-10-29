import type { Metadata } from "next";
import { ProductListing } from "@/components/store/product-listing";
import { pageMetadata } from "@/lib/seo";
import { hasRefinements, parseListingQuery, type SearchParamsInput } from "@/schemas/catalog";
import {
  listActiveBrands,
  listActiveCategories,
  listPublishedProducts,
} from "@/server/catalog.service";

type Props = { searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseListingQuery(await searchParams);
  return pageMetadata({
    title: "العروض والخصومات",
    description: "عطور بأسعار مخفضة لفترة محدودة.",
    path: "/offers",
    noindex: hasRefinements(query) || query.page > 1,
  });
}

export default async function OffersPage({ searchParams }: Props) {
  const query = parseListingQuery(await searchParams);
  const [result, categories, brands] = await Promise.all([
    listPublishedProducts(query, { onSale: true }),
    listActiveCategories(),
    listActiveBrands(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">العروض والخصومات</h1>
        <p className="text-muted">الأسعار المعروضة هي أسعار المتجر الحالية بعد الخصم.</p>
      </header>
      <ProductListing
        basePath="/offers"
        query={query}
        result={result}
        categories={categories}
        brands={brands}
        emptyTitle="لا توجد عروض حاليًا"
      />
    </div>
  );
}
