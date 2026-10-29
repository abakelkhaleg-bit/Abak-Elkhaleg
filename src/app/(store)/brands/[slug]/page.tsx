import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { excerpt, pageMetadata } from "@/lib/seo";
import { hasRefinements, parseListingQuery, type SearchParamsInput } from "@/schemas/catalog";
import {
  getActiveBrandBySlug,
  listActiveCategories,
  listPublishedProducts,
} from "@/server/catalog.service";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getActiveBrandBySlug(decodeURIComponent(slug));
  if (!brand) return { title: "الماركة غير موجودة", robots: { index: false } };
  const query = parseListingQuery(await searchParams);
  return pageMetadata({
    title: brand.seo.title || `عطور ${brand.name}`,
    description:
      brand.seo.description || excerpt(brand.description || `تسوّق عطور ${brand.name}.`),
    path: `/brands/${brand.slug}`,
    noindex: hasRefinements(query) || query.page > 1,
    image: brand.logo?.src,
  });
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const brand = await getActiveBrandBySlug(decodeURIComponent(slug));
  if (!brand) notFound();

  const query = { ...parseListingQuery(await searchParams), brand: undefined };
  const [result, categories] = await Promise.all([
    listPublishedProducts(query, { brandId: brand.objectId }),
    listActiveCategories(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "الرئيسية", href: "/" },
          { label: "الماركات", href: "/brands" },
          { label: brand.name },
        ]}
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">عطور {brand.name}</h1>
        {brand.description ? (
          <p className="max-w-3xl leading-8 text-muted">{brand.description}</p>
        ) : null}
      </header>
      <ProductListing
        basePath={`/brands/${brand.slug}`}
        query={query}
        result={result}
        categories={categories}
        brands={null}
      />
    </div>
  );
}
