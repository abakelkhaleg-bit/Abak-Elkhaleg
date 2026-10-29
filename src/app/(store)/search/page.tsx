import type { Metadata } from "next";
import { ProductListing } from "@/components/store/product-listing";
import { pageMetadata } from "@/lib/seo";
import { LISTING_PAGE_SIZE, parseListingQuery, type SearchParamsInput } from "@/schemas/catalog";
import {
  listActiveBrands,
  listActiveCategories,
  listPublishedProducts,
} from "@/server/catalog.service";

type Props = { searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseListingQuery(await searchParams);
  return pageMetadata({
    title: query.q ? `نتائج البحث عن «${query.q}»` : "البحث",
    path: "/search",
    noindex: true,
  });
}

export default async function SearchPage({ searchParams }: Props) {
  const query = parseListingQuery(await searchParams);
  const [result, categories, brands] = await Promise.all([
    query.q
      ? listPublishedProducts(query)
      : Promise.resolve({ items: [], total: 0, page: 1, pageCount: 1, pageSize: LISTING_PAGE_SIZE }),
    listActiveCategories(),
    listActiveBrands(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">
          {query.q ? (
            <>
              نتائج البحث عن «<bdi>{query.q}</bdi>»
            </>
          ) : (
            "البحث"
          )}
        </h1>
        {!query.q ? (
          <p className="text-muted">اكتب اسم العطر أو الماركة أو القسم في مربع البحث.</p>
        ) : null}
      </header>
      <ProductListing
        basePath="/search"
        query={query}
        result={result}
        categories={categories}
        brands={brands}
        emptyTitle={query.q ? "لم نجد عطورًا مطابقة لبحثك" : "ابدأ البحث"}
      />
    </div>
  );
}
