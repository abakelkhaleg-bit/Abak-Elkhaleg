import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, type Crumb } from "@/components/store/breadcrumbs";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductGrid } from "@/components/store/product-grid";
import { SectionHeading } from "@/components/store/section-heading";
import { PurchasePanel } from "@/features/cart/purchase-panel";
import { excerpt, pageMetadata } from "@/lib/seo";
import { getPublishedProductBySlug, getRelatedProducts } from "@/server/catalog.service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(decodeURIComponent(slug));
  if (!product) return { title: "العطر غير موجود", robots: { index: false } };
  return pageMetadata({
    title: product.seo.title || product.name,
    description: product.seo.description || excerpt(product.shortDescription),
    path: `/perfumes/${product.slug}`,
    image: product.images[0]?.src,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(decodeURIComponent(slug));
  if (!product) notFound();

  const related = await getRelatedProducts(product.id);
  const crumbs: Crumb[] = [
    { label: "الرئيسية", href: "/" },
    product.category
      ? { label: product.category.name, href: `/categories/${product.category.slug}` }
      : { label: "جميع العطور", href: "/perfumes" },
    { label: product.name },
  ];
  const paragraphs = product.description
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={crumbs} />

      <article className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            {product.brand ? (
              <Link
                href={`/brands/${product.brand.slug}`}
                className="w-fit text-sm font-medium text-gold-text hover:underline"
              >
                {product.brand.name}
              </Link>
            ) : null}
            <h1 className="text-3xl leading-snug sm:text-4xl">{product.name}</h1>
            {product.category ? (
              <p className="text-sm text-muted">
                القسم:{" "}
                <Link href={`/categories/${product.category.slug}`} className="hover:underline">
                  {product.category.name}
                </Link>
              </p>
            ) : null}
            <p className="leading-8 text-charcoal">{product.shortDescription}</p>
          </header>

          <div className="rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60">
            <PurchasePanel
              productId={product.id}
              productName={product.name}
              variants={product.variants}
            />
          </div>

          {paragraphs.length > 0 ? (
            <section aria-labelledby="description-title" className="flex flex-col gap-3">
              <h2 id="description-title" className="text-xl">
                تفاصيل العطر
              </h2>
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line leading-8 text-charcoal">
                  {paragraph}
                </p>
              ))}
            </section>
          ) : null}
        </div>
      </article>

      {related.length > 0 ? (
        <section aria-labelledby="related-title">
          <SectionHeading id="related-title" title="قد يعجبك أيضًا" />
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  );
}
