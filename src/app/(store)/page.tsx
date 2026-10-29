import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/store/empty-state";
import { ProductGrid } from "@/components/store/product-grid";
import { SectionHeading } from "@/components/store/section-heading";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import { getHomeData } from "@/server/catalog.service";
import { getPublicStoreSettings } from "@/server/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicStoreSettings();
  const title = settings.defaultSeo.title || settings.storeName;
  return {
    ...pageMetadata({
      title,
      description: settings.defaultSeo.description || settings.description,
      path: "/",
    }),
    title: { absolute: title },
  };
}

export default async function HomePage() {
  const [home, settings] = await Promise.all([getHomeData(), getPublicStoreSettings()]);
  const { emblem } = siteConfig.brandAssets;
  const heroImage = settings.homepage.heroImage;

  return (
    <>
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-cream),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20 lg:px-8">
          <div className="flex flex-col items-start gap-5">
            <span className="text-sm font-medium tracking-wide text-gold-text">
              عطور شرقية · عود · مسك · عطور فاخرة
            </span>
            <h1 id="hero-title" className="text-4xl font-extrabold leading-tight sm:text-5xl">
              {settings.homepage.heroTitle || "عطور تليق بحضورك"}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-muted">
              {settings.homepage.heroSubtitle ||
                "تشكيلة مختارة من العود والمسك والعطور الشرقية والغربية بأحجام تناسبك."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/perfumes"
                className="rounded-md bg-charcoal px-7 py-3 font-bold text-ivory transition-colors hover:bg-espresso"
              >
                تصفح العطور
              </Link>
              {home.offers.length > 0 ? (
                <Link
                  href="/offers"
                  className="rounded-md border border-gold px-7 py-3 font-bold text-gold-text transition-colors hover:bg-cream"
                >
                  العروض
                </Link>
              ) : null}
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-xs sm:max-w-sm md:max-w-md">
            {heroImage ? (
              <Image
                src={heroImage.src}
                alt={heroImage.alt}
                fill
                priority
                sizes="(min-width: 768px) 448px, 80vw"
                className="rounded-full object-cover shadow-lifted"
              />
            ) : (
              <Image
                src={emblem.src}
                alt={settings.storeName}
                width={emblem.width}
                height={emblem.height}
                priority
                sizes="(min-width: 768px) 448px, 80vw"
                className="h-full w-full drop-shadow-xl"
              />
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-20 sm:px-6 lg:px-8">
        {home.categories.length > 0 ? (
          <section aria-labelledby="categories-title">
            <SectionHeading id="categories-title" title="تسوّق حسب القسم" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {home.categories.map((category) => (
                <li key={category.id}>
                  {category.image ? (
                    <Link
                      href={`/categories/${category.slug}`}
                      className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg bg-cream p-4 ring-1 ring-sand/60 transition-shadow hover:shadow-lifted"
                    >
                      <Image
                        src={category.image.src}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 300px, 50vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <span className="relative rounded-md bg-ivory/90 px-3 py-1.5 font-bold text-espresso">
                        {category.name}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      href={`/categories/${category.slug}`}
                      className="flex h-full items-center gap-3 rounded-lg bg-white px-4 py-5 ring-1 ring-sand/60 transition hover:shadow-soft hover:ring-gold"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cream text-gold"
                      >
                        ✦
                      </span>
                      <span className="font-bold text-espresso">{category.name}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {home.featured.length > 0 ? (
          <section aria-labelledby="featured-title">
            <SectionHeading
              id="featured-title"
              title="عطور مميزة"
              subtitle="اختيارات المتجر لك"
              link={{ href: "/perfumes", label: "عرض الكل" }}
            />
            <ProductGrid products={home.featured} />
          </section>
        ) : null}

        {settings.homepage.promoBanners.length > 0 ? (
          <section aria-label="عروض المتجر" className="grid gap-4 md:grid-cols-2">
            {settings.homepage.promoBanners.map((banner) => (
              <Link
                key={`${banner.title}-${banner.href}`}
                href={banner.href}
                className="relative flex min-h-44 flex-col justify-end overflow-hidden rounded-lg bg-espresso p-6 text-ivory"
              >
                {banner.image ? (
                  <Image
                    src={banner.image.src}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover opacity-40"
                  />
                ) : null}
                <span className="relative text-2xl font-bold text-ivory">{banner.title}</span>
                {banner.subtitle ? (
                  <span className="relative mt-1 text-sm text-cream/90">{banner.subtitle}</span>
                ) : null}
              </Link>
            ))}
          </section>
        ) : null}

        {home.offers.length > 0 ? (
          <section aria-labelledby="offers-title">
            <SectionHeading
              id="offers-title"
              title="العروض والخصومات"
              link={{ href: "/offers", label: "كل العروض" }}
            />
            <ProductGrid products={home.offers} />
          </section>
        ) : null}

        {home.latest.length > 0 ? (
          <section aria-labelledby="latest-title">
            <SectionHeading
              id="latest-title"
              title="وصل حديثًا"
              link={{ href: "/perfumes?sort=newest", label: "عرض الأحدث" }}
            />
            <ProductGrid products={home.latest} />
          </section>
        ) : (
          <EmptyState
            title="نجهّز تشكيلتنا لكم"
            description="لم تُضف عطور إلى المتجر بعد. تابعونا قريبًا."
          />
        )}

        <section
          aria-labelledby="about-title"
          className="rounded-lg bg-cream px-6 py-10 text-center ring-1 ring-sand/60 sm:px-12"
        >
          <h2 id="about-title" className="text-2xl">
            عن {settings.storeName}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl leading-8 text-muted">{settings.description}</p>
        </section>
      </div>
    </>
  );
}
