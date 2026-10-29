import { EmptyState } from "@/components/store/empty-state";
import { ListingFilters } from "@/components/store/listing-filters";
import { Pagination } from "@/components/store/pagination";
import { ProductGrid } from "@/components/store/product-grid";
import { hasRefinements, type ListingQuery } from "@/schemas/catalog";
import type { ListingResult, TaxonomyRef } from "@/types/catalog";

const arabicNumber = new Intl.NumberFormat("ar-EG");

/** قائمة منتجات مع فلاتر وعدد نتائج وترقيم صفحات — مشتركة بين كل صفحات القوائم. */
export function ProductListing({
  basePath,
  query,
  result,
  categories,
  brands,
  showSearch = true,
  emptyTitle = "لا توجد عطور مطابقة",
}: {
  basePath: string;
  query: ListingQuery;
  result: ListingResult;
  categories: TaxonomyRef[] | null;
  brands: TaxonomyRef[] | null;
  showSearch?: boolean;
  emptyTitle?: string;
}) {
  const filterProps = { basePath, query, categories, brands, showSearch };
  const refined = hasRefinements(query);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-10">
      <aside aria-label="تصفية النتائج">
        <details
          className="rounded-lg bg-white p-4 shadow-soft ring-1 ring-sand/60 lg:hidden"
          data-testid="filters-mobile"
        >
          <summary className="cursor-pointer text-sm font-bold text-espresso">التصفية والترتيب</summary>
          <div className="mt-4">
            <ListingFilters idPrefix="m" {...filterProps} />
          </div>
        </details>
        <div
          className="hidden rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60 lg:sticky lg:top-28 lg:block"
          data-testid="filters-desktop"
        >
          <ListingFilters idPrefix="d" {...filterProps} />
        </div>
      </aside>

      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted" aria-live="polite" data-testid="results-count">
          {result.total === 0
            ? "لا توجد نتائج"
            : `${arabicNumber.format(result.total)} ${result.total === 1 ? "عطر" : "عطور"}`}
          {result.pageCount > 1
            ? ` · الصفحة ${arabicNumber.format(result.page)} من ${arabicNumber.format(result.pageCount)}`
            : ""}
        </p>

        {result.items.length > 0 ? (
          <>
            <ProductGrid products={result.items} priorityCount={4} />
            <Pagination
              basePath={basePath}
              query={query}
              page={result.page}
              pageCount={result.pageCount}
            />
          </>
        ) : (
          <EmptyState
            title={emptyTitle}
            description={
              refined
                ? "جرّب كلمات بحث أخرى أو قلّل الفلاتر المستخدمة."
                : "لم تُضف عطور في هذا القسم بعد."
            }
            action={refined ? { href: basePath, label: "إزالة الفلاتر" } : { href: "/perfumes", label: "تصفح كل العطور" }}
          />
        )}
      </div>
    </div>
  );
}
