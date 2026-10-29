import { piastersToDecimalString } from "@/lib/money";
import type { ListingQuery } from "@/schemas/catalog";

/**
 * يبني روابط صفحات القوائم مع الحفاظ على الفلاتر الحالية (للصفحات والترتيب).
 * القيم الافتراضية لا تُكتب في الرابط حتى تبقى الروابط قصيرة ومستقرة.
 */
export function listingHref(
  basePath: string,
  query: Partial<ListingQuery>,
  overrides: Partial<ListingQuery> = {},
): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.category) params.set("category", merged.category);
  if (merged.brand) params.set("brand", merged.brand);
  if (merged.min !== undefined) params.set("min", trimDecimal(merged.min));
  if (merged.max !== undefined) params.set("max", trimDecimal(merged.max));
  if (merged.inStock) params.set("inStock", "1");
  if (merged.sort && merged.sort !== "featured") params.set("sort", merged.sort);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

function trimDecimal(piasters: number): string {
  return piastersToDecimalString(piasters).replace(/\.00$/, "");
}

/** أرقام الصفحات المعروضة: الأولى والأخيرة وما حول الحالية، مع فواصل. */
export function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((p, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && p - previous > 1) result.push("gap");
    result.push(p);
  });
  return result;
}
