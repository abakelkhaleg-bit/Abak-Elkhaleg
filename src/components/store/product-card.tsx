import Link from "next/link";
import { siteConfig } from "@/config/site";
import { FallbackImage } from "@/components/store/fallback-image";
import { PriceTag } from "@/components/store/price-tag";
import type { ProductCardData } from "@/types/catalog";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const image = product.image ?? {
    src: siteConfig.brandAssets.placeholder,
    alt: product.name,
  };
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-soft ring-1 ring-sand/60 transition-shadow hover:shadow-lifted">
      <div className="relative aspect-[4/5] overflow-hidden bg-cream">
        <FallbackImage
          src={image.src}
          alt={image.alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 280px, (min-width: 768px) 30vw, 50vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {product.compareAtPrice ? (
            <span className="rounded-sm bg-danger px-2 py-0.5 text-xs font-bold text-white">عرض</span>
          ) : null}
          {!product.inStock ? (
            <span className="rounded-sm bg-charcoal/85 px-2 py-0.5 text-xs font-bold text-ivory">
              نفد المخزون
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {product.brandName ? (
          <span className="text-xs font-medium text-gold-text">{product.brandName}</span>
        ) : null}
        <h3 className="text-sm font-bold leading-6 text-charcoal sm:text-base">
          <Link
            href={`/perfumes/${product.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-gold"
          >
            {product.name}
          </Link>
        </h3>
        <PriceTag
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          startingFrom={product.hasMultiplePrices}
          className="mt-auto"
        />
      </div>
    </article>
  );
}
