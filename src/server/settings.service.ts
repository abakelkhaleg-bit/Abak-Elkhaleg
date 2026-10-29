import "server-only";
import { cache } from "react";
import { siteConfig } from "@/config/site";
import { connectToDatabase } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadStoreSettings } from "@/models/store-settings";
import type { ImageView } from "@/types/catalog";

/**
 * إعدادات المتجر العامة كما تعرضها الواجهة. رقم واتساب لا يُكتب في أي مكوّن؛
 * يُقرأ من هنا فقط. عند تعذر الاتصال بقاعدة البيانات تُعاد القيم الافتراضية
 * حتى يبقى الـHeader والـFooter ظاهرين، ويُسجل الخطأ على الخادم.
 */

export type PublicStoreSettings = {
  storeName: string;
  description: string;
  whatsappNumber: string | null;
  contact: { phone?: string; email?: string; address?: string; workingHours?: string };
  socialLinks: Array<{ key: string; label: string; href: string }>;
  policies: Array<{ slug: string; title: string }>;
  homepage: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroImage: ImageView | null;
    promoBanners: Array<{ title: string; subtitle: string | null; href: string; image: ImageView | null }>;
  };
  defaultSeo: { title?: string; description?: string };
  available: boolean;
};

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "إنستجرام",
  facebook: "فيسبوك",
  tiktok: "تيك توك",
  x: "إكس",
  snapchat: "سناب شات",
};

const FALLBACK: PublicStoreSettings = {
  storeName: siteConfig.defaultName,
  description: siteConfig.defaultDescription,
  whatsappNumber: null,
  contact: {},
  socialLinks: [],
  policies: [],
  homepage: { heroTitle: null, heroSubtitle: null, heroImage: null, promoBanners: [] },
  defaultSeo: {},
  available: false,
};

export const getPublicStoreSettings = cache(async (): Promise<PublicStoreSettings> => {
  try {
    await connectToDatabase();
    const settings = await loadStoreSettings();
    const toImage = (image?: { secureUrl: string; altText?: string } | null, alt = "") =>
      image ? { src: image.secureUrl, alt: image.altText || alt } : null;

    return {
      storeName: settings.storeName,
      description: settings.description,
      whatsappNumber: settings.whatsappNumber ?? null,
      contact: {
        phone: settings.contact?.phone,
        email: settings.contact?.email,
        address: settings.contact?.address,
        workingHours: settings.contact?.workingHours,
      },
      socialLinks: Object.entries(settings.socialLinks ?? {})
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "")
        .filter(([key]) => key in SOCIAL_LABELS)
        .map(([key, href]) => ({ key, label: SOCIAL_LABELS[key] ?? key, href })),
      policies: settings.policies.map((policy) => ({ slug: policy.slug, title: policy.title })),
      homepage: {
        heroTitle: settings.homepage?.heroTitle ?? null,
        heroSubtitle: settings.homepage?.heroSubtitle ?? null,
        heroImage: toImage(settings.homepage?.heroImage, settings.storeName),
        promoBanners: (settings.homepage?.promoBanners ?? [])
          .filter((banner) => banner.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((banner) => ({
            title: banner.title,
            subtitle: banner.subtitle ?? null,
            href: banner.href,
            image: toImage(banner.image, banner.title),
          })),
      },
      defaultSeo: {
        title: settings.defaultSeo?.title,
        description: settings.defaultSeo?.description,
      },
      available: true,
    };
  } catch (error) {
    logger.error("تعذر تحميل إعدادات المتجر؛ تُستخدم القيم الافتراضية", { error });
    return FALLBACK;
  }
});

export async function getPolicyBySlug(
  slug: string,
): Promise<{ title: string; body: string } | null> {
  await connectToDatabase();
  const settings = await loadStoreSettings();
  const policy = settings.policies.find((item) => item.slug === slug);
  return policy ? { title: policy.title, body: policy.body } : null;
}
