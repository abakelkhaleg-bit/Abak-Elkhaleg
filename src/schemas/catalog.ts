import { z } from "zod";
import { parsePoundsToPiasters } from "@/lib/money";
import { SLUG_PATTERN } from "@/lib/validation-rules";

/**
 * معاملات صفحات القوائم من الرابط (searchParams). أي قيمة غير صالحة تُتجاهل بهدوء
 * بدل إظهار خطأ — الرابط يأتي من المستخدم ويمكن العبث به.
 */

export const SORT_OPTIONS = ["featured", "newest", "price_asc", "price_desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  featured: "المميز أولًا",
  newest: "الأحدث",
  price_asc: "السعر: من الأقل",
  price_desc: "السعر: من الأعلى",
};

export const LISTING_PAGE_SIZE = 24;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const optionalSlug = z.preprocess(
  first,
  z.string().trim().regex(SLUG_PATTERN).optional().catch(undefined),
);

const optionalPounds = z.preprocess(
  first,
  z
    .string()
    .optional()
    .transform((value) => (value ? (parsePoundsToPiasters(value) ?? undefined) : undefined))
    .catch(undefined),
);

export const listingQuerySchema = z.object({
  q: z.preprocess(
    first,
    z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((value) => (value ? value : undefined))
      .catch(undefined),
  ),
  category: optionalSlug,
  brand: optionalSlug,
  min: optionalPounds,
  max: optionalPounds,
  inStock: z.preprocess(first, z.literal("1").optional().catch(undefined)),
  sort: z.preprocess(first, z.enum(SORT_OPTIONS).catch("featured")),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(1000).catch(1)),
});

export type ListingQuery = z.infer<typeof listingQuerySchema>;

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export function parseListingQuery(searchParams: SearchParamsInput): ListingQuery {
  return listingQuerySchema.parse(searchParams);
}

/** هل في الرابط فلاتر تجعل الصفحة غير مناسبة للفهرسة (محتوى مكرر)؟ */
export function hasRefinements(query: ListingQuery): boolean {
  return Boolean(
    query.q ||
      query.category ||
      query.brand ||
      query.min !== undefined ||
      query.max !== undefined ||
      query.inStock ||
      query.sort !== "featured",
  );
}

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(64),
});
