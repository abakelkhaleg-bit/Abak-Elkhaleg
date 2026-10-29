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
    title: "جميع العطور",
    description: "تصفّح كل عطور المتجر: عود ومسك وعطور شرقية وغربية للرجال والنساء.",
    path: "/perfumes",
    noindex: hasRefinements(query) || query.page > 1,
  });
}

export default async function PerfumesPage({ searchParams }: Props) {
  const query = parseListingQuery(await searchParams);
  const [result, categories, brands] = await Promise.all([
    listPublishedProducts(query),
    listActiveCategories(),
    listActiveBrands(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">جميع العطور</h1>
        <p className="text-muted">اختر عطرك المفضل من تشكيلتنا الكاملة.</p>
      </header>
      <ProductListing
        basePath="/perfumes"
        query={query}
        result={result}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}
