import Link from "next/link";
import { cn } from "@/lib/cn";
import { listingHref, pageWindow } from "@/lib/listing-url";
import type { ListingQuery } from "@/schemas/catalog";

const arabicNumber = new Intl.NumberFormat("ar-EG");

export function Pagination({
  basePath,
  query,
  page,
  pageCount,
}: {
  basePath: string;
  query: ListingQuery;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const linkClass =
    "inline-flex min-w-10 items-center justify-center rounded-md border border-sand px-3 py-2 text-sm transition-colors hover:border-gold hover:text-gold-text";

  return (
    <nav aria-label="التنقل بين الصفحات" className="flex justify-center">
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <li>
            <Link
              href={listingHref(basePath, query, { page: page - 1 })}
              className={linkClass}
              rel="prev"
            >
              السابق
            </Link>
          </li>
        ) : null}
        {pageWindow(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={listingHref(basePath, query, { page: item })}
                aria-current={item === page ? "page" : undefined}
                aria-label={`الصفحة ${arabicNumber.format(item)}`}
                className={cn(
                  linkClass,
                  item === page && "border-charcoal bg-charcoal text-ivory hover:text-ivory",
                )}
              >
                {arabicNumber.format(item)}
              </Link>
            </li>
          ),
        )}
        {page < pageCount ? (
          <li>
            <Link
              href={listingHref(basePath, query, { page: page + 1 })}
              className={linkClass}
              rel="next"
            >
              التالي
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
