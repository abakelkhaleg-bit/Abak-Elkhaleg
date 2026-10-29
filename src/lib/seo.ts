import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

/**
 * Metadata موحدة للصفحات: عنوان، وصف، canonical نسبي (يُكمَّل بـ metadataBase)، وOpen Graph.
 * صفحات البحث والفلترة تأخذ noindex مع canonical للصفحة الأساسية لتجنب المحتوى المكرر.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
  image,
}: {
  title: string;
  description?: string;
  path: string;
  noindex?: boolean;
  image?: string | null;
}): Metadata {
  const finalDescription = description?.trim() || siteConfig.defaultDescription;
  return {
    title,
    description: finalDescription,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: finalDescription,
      url: path,
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.defaultName,
      images: [{ url: image ?? siteConfig.brandAssets.ogDefault }],
    },
  };
}

/** نص مختصر صالح للوصف من فقرة طويلة. */
export function excerpt(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
