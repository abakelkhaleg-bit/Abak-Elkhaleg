import Link from "next/link";
import { piastersToDecimalString } from "@/lib/money";
import { SORT_LABELS, SORT_OPTIONS, type ListingQuery } from "@/schemas/catalog";
import type { TaxonomyRef } from "@/types/catalog";

/**
 * نموذج الفلترة — GET عادي يعمل حتى بدون JavaScript، والنتائج تُحسب على الخادم.
 * الحقول الثابتة للصفحة (مثل التصنيف في صفحة تصنيف) لا تظهر كفلتر.
 */
export function ListingFilters({
  idPrefix,
  basePath,
  query,
  categories,
  brands,
  showSearch,
}: {
  idPrefix: string;
  basePath: string;
  query: ListingQuery;
  categories: TaxonomyRef[] | null;
  brands: TaxonomyRef[] | null;
  showSearch: boolean;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const pounds = (value: number | undefined) =>
    value === undefined ? "" : piastersToDecimalString(value).replace(/\.00$/, "");
  const fieldClass =
    "w-full rounded-md border border-sand bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none";
  const labelClass = "text-sm font-medium text-espresso";

  return (
    <form action={basePath} method="get" className="flex flex-col gap-4" role="search">
      {showSearch ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("q")} className={labelClass}>
            بحث
          </label>
          <input
            id={id("q")}
            name="q"
            type="search"
            defaultValue={query.q ?? ""}
            maxLength={64}
            placeholder="اسم العطر أو الماركة"
            className={fieldClass}
          />
        </div>
      ) : null}

      {categories ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("category")} className={labelClass}>
            التصنيف
          </label>
          <select
            id={id("category")}
            name="category"
            defaultValue={query.category ?? ""}
            className={fieldClass}
          >
            <option value="">كل التصنيفات</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {brands ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("brand")} className={labelClass}>
            الماركة
          </label>
          <select id={id("brand")} name="brand" defaultValue={query.brand ?? ""} className={fieldClass}>
            <option value="">كل الماركات</option>
            {brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${labelClass} mb-1.5`}>السعر (ج.م)</legend>
        <div className="flex items-center gap-2">
          <label htmlFor={id("min")} className="sr-only">
            أقل سعر
          </label>
          <input
            id={id("min")}
            name="min"
            inputMode="decimal"
            defaultValue={pounds(query.min)}
            placeholder="من"
            className={fieldClass}
          />
          <span aria-hidden="true" className="text-muted">
            –
          </span>
          <label htmlFor={id("max")} className="sr-only">
            أعلى سعر
          </label>
          <input
            id={id("max")}
            name="max"
            inputMode="decimal"
            defaultValue={pounds(query.max)}
            placeholder="إلى"
            className={fieldClass}
          />
        </div>
      </fieldset>

      <label htmlFor={id("inStock")} className="flex items-center gap-2 text-sm">
        <input
          id={id("inStock")}
          type="checkbox"
          name="inStock"
          value="1"
          defaultChecked={query.inStock === "1"}
          className="size-4 accent-[var(--color-gold)]"
        />
        المتوفر فقط
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={id("sort")} className={labelClass}>
          الترتيب
        </label>
        <select id={id("sort")} name="sort" defaultValue={query.sort} className={fieldClass}>
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex-1 rounded-md bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-espresso"
        >
          تطبيق
        </button>
        <Link
          href={basePath}
          className="rounded-md border border-sand px-4 py-2.5 text-sm text-muted transition-colors hover:border-gold hover:text-gold-text"
        >
          إزالة الفلاتر
        </Link>
      </div>
    </form>
  );
}
