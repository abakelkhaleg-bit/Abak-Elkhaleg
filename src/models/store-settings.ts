import { Schema, type HydratedDocument, type Model } from "mongoose";
import { isDuplicateKeyError } from "@/lib/errors";
import { siteConfig } from "@/config/site";
import {
  LIMITS,
  SLUG_PATTERN,
  WHATSAPP_E164_PATTERN,
} from "@/lib/validation-rules";
import { taxonomyImageSchema, type TaxonomyImage } from "@/models/category";
import { defineModel, integerValidator } from "@/models/_mongoose";

/**
 * إعدادات المتجر — مستند واحد فقط بالمعرّف الثابت "store". راجع docs/DATABASE.md §3.8.
 * لا تُقرأ إلا عبر loadStoreSettings() التي تنشئه عند الحاجة دون تكرار.
 */

export const STORE_SETTINGS_ID = "store";

const HTTPS_URL = /^https:\/\/[^\s]+$/;
/** رابط داخلي يبدأ بـ "/" (وليس "//") أو رابط https. */
const SAFE_HREF = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;

export interface PromoBanner {
  title: string;
  subtitle?: string;
  image?: TaxonomyImage;
  href: string;
  isActive: boolean;
  sortOrder: number;
}

export interface StorePolicy {
  slug: string;
  title: string;
  body: string;
}

export interface StoreSettings {
  _id: string;
  storeName: string;
  logo?: TaxonomyImage;
  whatsappNumber?: string;
  contact: {
    phone?: string;
    email?: string;
    address?: string;
    workingHours?: string;
  };
  description: string;
  defaultSeo: {
    title?: string;
    description?: string;
    ogImage?: TaxonomyImage;
  };
  socialLinks: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    x?: string;
    snapchat?: string;
  };
  policies: StorePolicy[];
  homepage: {
    heroTitle?: string;
    heroSubtitle?: string;
    heroImage?: TaxonomyImage;
    promoBanners: PromoBanner[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export type StoreSettingsDocument = HydratedDocument<StoreSettings>;
export type StoreSettingsModel = Model<StoreSettings>;

const httpsLink = {
  type: String,
  trim: true,
  match: [HTTPS_URL, "الرابط يجب أن يبدأ بـ https://"] as [RegExp, string],
};

const promoBannerSchema = new Schema<PromoBanner>({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  subtitle: { type: String, trim: true, maxlength: 160 },
  image: { type: taxonomyImageSchema, required: false },
  href: {
    type: String,
    required: true,
    trim: true,
    match: [SAFE_HREF, "الرابط يجب أن يكون مسارًا داخليًا يبدأ بـ / أو رابط https."],
  },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0, validate: integerValidator },
});

const policySchema = new Schema<StorePolicy>(
  {
    slug: { type: String, required: true, trim: true, match: SLUG_PATTERN },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: LIMITS.policyBody.max },
  },
  { _id: false },
);

const storeSettingsSchema = new Schema<StoreSettings, StoreSettingsModel>(
  {
    _id: { type: String, default: STORE_SETTINGS_ID, enum: [STORE_SETTINGS_ID] },
    storeName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default: siteConfig.defaultName,
    },
    logo: { type: taxonomyImageSchema, required: false },
    whatsappNumber: {
      type: String,
      trim: true,
      match: [WHATSAPP_E164_PATTERN, "رقم واتساب يجب أن يكون رقم موبايل مصري صالحًا."],
    },
    contact: {
      phone: { type: String, trim: true, maxlength: 30 },
      email: { type: String, trim: true, lowercase: true, maxlength: 120 },
      address: { type: String, trim: true, maxlength: 300 },
      workingHours: { type: String, trim: true, maxlength: 120 },
    },
    description: {
      type: String,
      trim: true,
      maxlength: LIMITS.storeDescription.max,
      default: siteConfig.defaultDescription,
    },
    defaultSeo: {
      title: { type: String, trim: true, maxlength: LIMITS.seoTitle.max },
      description: { type: String, trim: true, maxlength: LIMITS.seoDescription.max },
      ogImage: { type: taxonomyImageSchema, required: false },
    },
    socialLinks: {
      instagram: httpsLink,
      facebook: httpsLink,
      tiktok: httpsLink,
      x: httpsLink,
      snapchat: httpsLink,
    },
    policies: { type: [policySchema], default: [] },
    homepage: {
      heroTitle: { type: String, trim: true, maxlength: 120 },
      heroSubtitle: { type: String, trim: true, maxlength: 300 },
      heroImage: { type: taxonomyImageSchema, required: false },
      promoBanners: { type: [promoBannerSchema], default: [] },
    },
  },
  { timestamps: true },
);

storeSettingsSchema.index({ "logo.publicId": 1 });

export const StoreSettingsModel = defineModel<StoreSettings, StoreSettingsModel>(
  "StoreSettings",
  storeSettingsSchema,
);

/**
 * يعيد مستند الإعدادات الوحيد، وينشئه بالقيم الافتراضية إن لم يكن موجودًا.
 * upsert على _id ثابت يمنع التكرار؛ وفي حالة سباق نادرة بين طلبين متزامنين
 * يرمي أحدهما E11000 فنعيد المحاولة مرة واحدة فيقرأ المستند الذي أنشأه الآخر.
 */
export async function loadStoreSettings(): Promise<StoreSettingsDocument> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const settings = await StoreSettingsModel.findOneAndUpdate(
        { _id: STORE_SETTINGS_ID },
        { $setOnInsert: { storeName: siteConfig.defaultName } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      if (!settings) throw new Error("تعذر تحميل إعدادات المتجر.");
      return settings;
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt >= 2) throw error;
    }
  }
}
