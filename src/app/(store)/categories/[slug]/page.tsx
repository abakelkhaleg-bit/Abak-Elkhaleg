import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/product-listing";
import { excerpt, pageMetadata } from "@/lib/seo";
import { hasRefinements, parseListingQuery, type SearchParamsInput } from "@/schemas/catalog";
import {
  getActiveCategoryBySlug,
  listActiveBrands,
  listPublishedProducts,
} from "@/server/catalog.service";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getActiveCategoryBySlug(decodeURIComponent(slug));
  if (!category) return { title: "القسم غير موجود", robots: { index: false } };
  const query = parseListingQuery(await searchParams);
  return pageMetadata({
    title: category.seo.title || category.name,
    description:
      category.seo.description || excerpt(category.description || `تسوّق ${category.name}.`),
    path: `/categories/${category.slug}`,
    noindex: hasRefinements(query) || query.page > 1,
    image: category.image?.src,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getActiveCategoryBySlug(decodeURIComponent(slug));
  if (!category) notFound();

  const query = { ...parseListingQuery(await searchParams), category: undefined };
  const [result, brands] = await Promise.all([
    listPublishedProducts(query, { categoryId: category.objectId }),
    listActiveBrands(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "الرئيسية", href: "/" },
          { label: "جميع العطور", href: "/perfumes" },
          { label: category.name },
        ]}
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{category.name}</h1>
        {category.description ? (
          <p className="max-w-3xl leading-8 text-muted">{category.description}</p>
        ) : null}
      </header>
      <ProductListing
        basePath={`/categories/${category.slug}`}
        query={query}
        result={result}
        categories={null}
        brands={brands}
      />
    </div>
  );
}
