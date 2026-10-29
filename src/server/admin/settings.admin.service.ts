import "server-only";
import { connectToDatabase } from "@/lib/db";
import { loadStoreSettings } from "@/models/store-settings";
import { storeSettingsInputSchema } from "@/schemas/settings";
import { parseInput } from "@/server/admin/validate";

/** قراءة وتعديل إعدادات المتجر من لوحة الإدارة (الصور في المرحلة 5). */

export type SettingsEditData = {
  storeName: string;
  whatsappLocal: string;
  contact: { phone: string; email: string; address: string; workingHours: string };
  description: string;
  defaultSeo: { title: string; description: string };
  socialLinks: { instagram: string; facebook: string; tiktok: string; x: string; snapchat: string };
  homepage: { heroTitle: string; heroSubtitle: string };
  policies: Array<{ slug: string; title: string; body: string }>;
};

/** 201012345678 → 01012345678 للعرض في النموذج. */
function whatsappToLocal(value?: string): string {
  return value?.startsWith("20") ? `0${value.slice(2)}` : (value ?? "");
}

export async function getSettingsForEdit(): Promise<SettingsEditData> {
  await connectToDatabase();
  const s = await loadStoreSettings();
  return {
    storeName: s.storeName,
    whatsappLocal: whatsappToLocal(s.whatsappNumber),
    contact: {
      phone: s.contact?.phone ?? "",
      email: s.contact?.email ?? "",
      address: s.contact?.address ?? "",
      workingHours: s.contact?.workingHours ?? "",
    },
    description: s.description ?? "",
    defaultSeo: { title: s.defaultSeo?.title ?? "", description: s.defaultSeo?.description ?? "" },
    socialLinks: {
      instagram: s.socialLinks?.instagram ?? "",
      facebook: s.socialLinks?.facebook ?? "",
      tiktok: s.socialLinks?.tiktok ?? "",
      x: s.socialLinks?.x ?? "",
      snapchat: s.socialLinks?.snapchat ?? "",
    },
    homepage: {
      heroTitle: s.homepage?.heroTitle ?? "",
      heroSubtitle: s.homepage?.heroSubtitle ?? "",
    },
    policies: s.policies.map((p) => ({ slug: p.slug, title: p.title, body: p.body })),
  };
}

export async function updateSettings(rawInput: unknown): Promise<void> {
  const input = parseInput(storeSettingsInputSchema, rawInput);
  await connectToDatabase();
  const settings = await loadStoreSettings();
  settings.storeName = input.storeName;
  settings.set("whatsappNumber", input.whatsappNumber);
  settings.set("contact", input.contact);
  settings.set("description", input.description ?? "");
  settings.set("defaultSeo.title", input.defaultSeo.title);
  settings.set("defaultSeo.description", input.defaultSeo.description);
  settings.set("socialLinks", input.socialLinks);
  settings.set("homepage.heroTitle", input.homepage.heroTitle);
  settings.set("homepage.heroSubtitle", input.homepage.heroSubtitle);
  settings.set("policies", input.policies);
  await settings.save();
}
