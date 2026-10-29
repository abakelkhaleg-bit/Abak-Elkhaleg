import "server-only";
import { cache } from "react";
import type { Types } from "mongoose";
import { escapeRegExp, normalizeArabic } from "@/lib/arabic-normalize";
import { connectToDatabase } from "@/lib/db";
import { LIMITS } from "@/lib/validation-rules";
import { BrandModel, type Brand } from "@/models/brand";
import { CategoryModel, type Category } from "@/models/category";
import { ProductModel, type Product, type ProductImage } from "@/models/product";
import { trusted } from "@/models/_mongoose";
import { LISTING_PAGE_SIZE, type ListingQuery, type SortOption } from "@/schemas/catalog";
import type {
  BrandCardData,
  CategoryCardData,
  ImageView,
  ListingResult,
  ProductCardData,
  ProductDetailData,
  VariantView,
} from "@/types/catalog";

/**
 * قراءة الكتالوج للمتجر العام. كل الاستعلامات تقتصر على المنتجات المنشورة،
 * مع projection لحقول العرض فقط، وحد أقصى للنتائج — لا يُحمَّل الكتالوج كاملًا أبدًا.
 */

type WithId<T> = T & { _id: Types.ObjectId };
export type LeanProduct = WithId<Product>;

const CARD_PROJECTION = {
  name: 1,
  slug: 1,
  brandId: 1,
  images: 1,
  variants: 1,
  minPrice: 1,
  inStock: 1,
  isOnSale: 1,
} as const;

const SORTS: Record<SortOption, Record<string, 1 | -1>> = {
  featured: { isFeatured: -1, sortOrder: 1, createdAt: -1, _id: -1 },
  newest: { createdAt: -1, _id: -1 },
  price_asc: { minPrice: 1, createdAt: -1, _id: -1 },
  price_desc: { minPrice: -1, createdAt: -1, _id: -1 },
};

// ─── تحويل إلى أشكال العرض ───────────────────────────────────────────────

export function toImageView(
  image: { secureUrl: string; altText?: string; width?: number; height?: number },
  fallbackAlt: string,
): ImageView {
  return {
    src: image.secureUrl,
    alt: image.altText || fallbackAlt,
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
  };
}

export function primaryImage(images: ProductImage[], fallbackAlt: string): ImageView | null {
  const image = [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return image ? toImageView(image, fallbackAlt) : null;
}

export function toProductCard(product: LeanProduct, brandName: string | null): ProductCardData {
  const available = product.variants.filter((variant) => variant.isAvailable);
  const priced = available.length > 0 ? available : product.variants;
  const cheapest = priced.reduce<(typeof priced)[number] | undefined>(
    (best, variant) => (!best || variant.price < best.price ? variant : best),
    undefined,
  );
  const compareAt =
    cheapest?.compareAtPrice && cheapest.compareAtPrice > cheapest.price
      ? cheapest.compareAtPrice
      : null;
  return {
    id: product._id.toString(),
    slug: product.slug,
    name: product.name,
    brandName,
    image: primaryImage(product.images, product.name),
    price: cheapest?.price ?? product.minPrice,
    compareAtPrice: compareAt,
    hasMultiplePrices: new Set(priced.map((variant) => variant.price)).size > 1,
    inStock: product.inStock,
    isOnSale: product.isOnSale,
  };
}

export function toVariantViews(product: Pick<LeanProduct, "variants">): VariantView[] {
  return product.variants
    .filter((variant) => variant.isAvailable)
    .sort((a, b) => a.sizeMl - b.sizeMl)
    .map((variant) => ({
      id: variant._id.toString(),
      sizeMl: variant.sizeMl,
      price: variant.price,
      compareAtPrice:
        variant.compareAtPrice && variant.compareAtPrice > variant.price
          ? variant.compareAtPrice
          : null,
      inStock: variant.stockQuantity > 0,
      maxQuantity: Math.max(0, Math.min(variant.stockQuantity, LIMITS.orderItemQuantity.max)),
    }));
}

async function brandNamesFor(
  products: Array<Pick<LeanProduct, "brandId">>,
): Promise<Map<string, string>> {
  const ids = [...new Set(products.map((product) => product.brandId.toString()))];
  if (ids.length === 0) return new Map();
  const brands = await BrandModel.find({ _id: trusted({ $in: ids }) }, { name: 1 }).lean<
    Array<WithId<Pick<Brand, "name">>>
  >();
  return new Map(brands.map((brand) => [brand._id.toString(), brand.name]));
}

async function toCards(products: LeanProduct[]): Promise<ProductCardData[]> {
  const brandNames = await brandNamesFor(products);
  return products.map((product) =>
    toProductCard(product, brandNames.get(product.brandId.toString()) ?? null),
  );
}

// ─── القوائم ─────────────────────────────────────────────────────────────

export type ListingScope = {
  categoryId?: Types.ObjectId;
  brandId?: Types.ObjectId;
  onSale?: boolean;
};

/** يبني فلتر Mongo من معاملات الرابط. المشغّلات التي نكتبها بأنفسنا مغلّفة بـ trusted(). */
export function buildListingFilter(
  query: Pick<ListingQuery, "q" | "min" | "max" | "inStock">,
  scope: ListingScope & {
    categoryIds?: Types.ObjectId[] | null;
    brandIds?: Types.ObjectId[] | null;
  },
): Record<string, unknown> {
  const filter: Record<string, unknown> = { isPublished: true };
  if (scope.categoryId) filter.categoryId = scope.categoryId;
  else if (scope.categoryIds) filter.categoryId = trusted({ $in: scope.categoryIds });
  if (scope.brandId) filter.brandId = scope.brandId;
  else if (scope.brandIds) filter.brandId = trusted({ $in: scope.brandIds });
  if (scope.onSale) filter.isOnSale = true;
  if (query.inStock) filter.inStock = true;

  if (query.min !== undefined || query.max !== undefined) {
    filter.minPrice = trusted({
      ...(query.min !== undefined ? { $gte: query.min } : {}),
      ...(query.max !== undefined ? { $lte: query.max } : {}),
    });
  }

  if (query.q) {
    const words = normalizeArabic(query.q).split(" ").filter(Boolean).slice(0, 5);
    if (words.length > 0) {
      filter.$and = words.map((word) => ({
        searchText: trusted({ $regex: escapeRegExp(word) }),
      }));
    }
  }
  return filter;
}

export async function listPublishedProducts(
  query: ListingQuery,
  scope: ListingScope = {},
): Promise<ListingResult> {
  await connectToDatabase();

  // الفلترة بالـslug من الرابط: إن لم يوجد التصنيف/الماركة (أو كانا مخفيين) فلا نتائج.
  let categoryIds: Types.ObjectId[] | null = null;
  let brandIds: Types.ObjectId[] | null = null;
  if (!scope.categoryId && query.category) {
    const category = await CategoryModel.findOne(
      { slug: query.category, isActive: true },
      { _id: 1 },
    ).lean<WithId<object>>();
    categoryIds = category ? [category._id] : [];
  }
  if (!scope.brandId && query.brand) {
    const brand = await BrandModel.findOne({ slug: query.brand, isActive: true }, { _id: 1 }).lean<
      WithId<object>
    >();
    brandIds = brand ? [brand._id] : [];
  }

  const filter = buildListingFilter(query, { ...scope, categoryIds, brandIds });
  const total = await ProductModel.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);

  const products = await ProductModel.find(filter, CARD_PROJECTION)
    .sort(SORTS[query.sort])
    .skip((page - 1) * LISTING_PAGE_SIZE)
    .limit(LISTING_PAGE_SIZE)
    .lean<LeanProduct[]>();

  return { items: await toCards(products), total, page, pageCount, pageSize: LISTING_PAGE_SIZE };
}

// ─── الصفحة الرئيسية ─────────────────────────────────────────────────────

export type HomeData = {
  featured: ProductCardData[];
  latest: ProductCardData[];
  offers: ProductCardData[];
  categories: CategoryCardData[];
};

const HOME_SECTION_SIZE = 8;

export async function getHomeData(): Promise<HomeData> {
  await connectToDatabase();
  const base = { isPublished: true };
  const [featured, latest, offers, categories] = await Promise.all([
    ProductModel.find({ ...base, isFeatured: true }, CARD_PROJECTION)
      .sort(SORTS.featured)
      .limit(HOME_SECTION_SIZE)
      .lean<LeanProduct[]>(),
    ProductModel.find(base, CARD_PROJECTION)
      .sort(SORTS.newest)
      .limit(HOME_SECTION_SIZE)
      .lean<LeanProduct[]>(),
    ProductModel.find({ ...base, isOnSale: true }, CARD_PROJECTION)
      .sort(SORTS.newest)
      .limit(HOME_SECTION_SIZE)
      .lean<LeanProduct[]>(),
    listActiveCategories(),
  ]);
  const brandNames = await brandNamesFor([...featured, ...latest, ...offers]);
  const map = (items: LeanProduct[]) =>
    items.map((product) =>
      toProductCard(product, brandNames.get(product.brandId.toString()) ?? null),
    );
  return { featured: map(featured), latest: map(latest), offers: map(offers), categories };
}

// ─── التصنيفات والماركات ─────────────────────────────────────────────────

function toCategoryCard(category: WithId<Category>): CategoryCardData {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image ? toImageView(category.image, category.name) : null,
  };
}

function toBrandCard(brand: WithId<Brand>): BrandCardData {
  return {
    id: brand._id.toString(),
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    logo: brand.logo ? toImageView(brand.logo, brand.name) : null,
  };
}

/** React cache: استعلام واحد لكل طلب حتى لو طلبه الـHeader والصفحة معًا. */
export const listActiveCategories = cache(async (): Promise<CategoryCardData[]> => {
  await connectToDatabase();
  const categories = await CategoryModel.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .limit(100)
    .lean<Array<WithId<Category>>>();
  return categories.map(toCategoryCard);
});

export const listActiveBrands = cache(async (): Promise<BrandCardData[]> => {
  await connectToDatabase();
  const brands = await BrandModel.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .limit(200)
    .lean<Array<WithId<Brand>>>();
  return brands.map(toBrandCard);
});

export const getActiveCategoryBySlug = cache(async (slug: string) => {
  await connectToDatabase();
  const category = await CategoryModel.findOne({ slug, isActive: true }).lean<WithId<Category>>();
  return category
    ? { ...toCategoryCard(category), objectId: category._id, seo: category.seo ?? {} }
    : null;
});

export const getActiveBrandBySlug = cache(async (slug: string) => {
  await connectToDatabase();
  const brand = await BrandModel.findOne({ slug, isActive: true }).lean<WithId<Brand>>();
  return brand ? { ...toBrandCard(brand), objectId: brand._id, seo: brand.seo ?? {} } : null;
});

// ─── صفحة المنتج ─────────────────────────────────────────────────────────

export const getPublishedProductBySlug = cache(
  async (slug: string): Promise<ProductDetailData | null> => {
    await connectToDatabase();
    const product = await ProductModel.findOne({ slug, isPublished: true }).lean<LeanProduct>();
    if (!product) return null;

    const [category, brand] = await Promise.all([
      CategoryModel.findById(product.categoryId, { name: 1, slug: 1, isActive: 1 }).lean<
        WithId<Pick<Category, "name" | "slug" | "isActive">>
      >(),
      BrandModel.findById(product.brandId, { name: 1, slug: 1, isActive: 1 }).lean<
        WithId<Pick<Brand, "name" | "slug" | "isActive">>
      >(),
    ]);

    return {
      id: product._id.toString(),
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      category: category?.isActive ? { name: category.name, slug: category.slug } : null,
      brand: brand?.isActive ? { name: brand.name, slug: brand.slug } : null,
      images: [...product.images]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => toImageView(image, product.name)),
      variants: toVariantViews(product),
      seo: { title: product.seo?.title, description: product.seo?.description },
      updatedAt: product.updatedAt.toISOString(),
    };
  },
);

/** منتجات مرتبطة: نفس التصنيف أولًا، ثم نفس الماركة لإكمال العدد. */
export async function getRelatedProducts(productId: string, limit = 4): Promise<ProductCardData[]> {
  await connectToDatabase();
  const product = await ProductModel.findById(productId, { categoryId: 1, brandId: 1 }).lean<
    WithId<Pick<Product, "categoryId" | "brandId">>
  >();
  if (!product) return [];

  const sameCategory = await ProductModel.find(
    { isPublished: true, categoryId: product.categoryId, _id: trusted({ $ne: product._id }) },
    CARD_PROJECTION,
  )
    .sort(SORTS.featured)
    .limit(limit)
    .lean<LeanProduct[]>();

  let related = sameCategory;
  if (related.length < limit) {
    const exclude = [product._id, ...related.map((item) => item._id)];
    const sameBrand = await ProductModel.find(
      { isPublished: true, brandId: product.brandId, _id: trusted({ $nin: exclude }) },
      CARD_PROJECTION,
    )
      .sort(SORTS.featured)
      .limit(limit - related.length)
      .lean<LeanProduct[]>();
    related = [...related, ...sameBrand];
  }
  return toCards(related);
}

// ─── اقتراحات البحث ──────────────────────────────────────────────────────

export type SearchSuggestion = { name: string; slug: string; brandName: string | null };

export async function searchSuggestions(q: string, limit = 6): Promise<SearchSuggestion[]> {
  await connectToDatabase();
  const filter = buildListingFilter({ q, min: undefined, max: undefined, inStock: undefined }, {});
  const products = await ProductModel.find(filter, { name: 1, slug: 1, brandId: 1 })
    .sort(SORTS.featured)
    .limit(limit)
    .lean<Array<WithId<Pick<Product, "name" | "slug" | "brandId">>>>();
  const brandNames = await brandNamesFor(products);
  return products.map((product) => ({
    name: product.name,
    slug: product.slug,
    brandName: brandNames.get(product.brandId.toString()) ?? null,
  }));
}
