import "server-only";
import { z } from "zod";

/**
 * التحقق من متغيرات البيئة على الخادم.
 * المتغيرات مقسمة إلى مجموعات تُتحقق منها عند أول استخدام، حتى لا يتطلب تشغيل
 * جزء من التطبيق أسرار جزء آخر (مثلًا Cloudinary قبل المرحلة 5).
 * لا يوجد هنا أي متغير يبدأ بـ NEXT_PUBLIC_.
 */

type EnvSource = Record<string, string | undefined>;

export class EnvValidationError extends Error {
  constructor(
    public readonly group: string,
    public readonly issues: string[],
  ) {
    super(
      `إعدادات البيئة غير صحيحة (${group}). راجع .env.example:\n` +
        issues.map((issue) => `  - ${issue}`).join("\n"),
    );
    this.name = "EnvValidationError";
  }
}

export function parseEnvGroup<T extends z.ZodType>(
  group: string,
  schema: T,
  source: EnvSource,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = issue.path.join(".") || "(root)";
      return `${key}: ${issue.message}`;
    });
    throw new EnvValidationError(group, issues);
  }
  return result.data;
}

const required = (name: string) =>
  z.string({ error: `${name} مطلوب` }).trim().min(1, `${name} مطلوب`);

export const coreEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url({ error: "APP_URL يجب أن يكون رابطًا كاملًا مثل https://example.com" }),
  MONGODB_URI: required("MONGODB_URI").regex(
    /^mongodb(\+srv)?:\/\//,
    "MONGODB_URI يجب أن يبدأ بـ mongodb:// أو mongodb+srv://",
  ),
});

export const securityEnvSchema = z.object({
  IP_HASH_SALT: required("IP_HASH_SALT").min(32, "IP_HASH_SALT يجب ألا يقل عن 32 حرفًا"),
  TRUSTED_PROXY_HEADER: z.enum(["x-forwarded-for", "x-real-ip"]).default("x-forwarded-for"),
  CRON_SECRET: required("CRON_SECRET").min(32, "CRON_SECRET يجب ألا يقل عن 32 حرفًا"),
});

export const cloudinaryEnvSchema = z.object({
  CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET"),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;
export type SecurityEnv = z.infer<typeof securityEnvSchema>;
export type CloudinaryEnv = z.infer<typeof cloudinaryEnvSchema>;

const appUrlSchema = coreEnvSchema.pick({ APP_URL: true });

let appUrlCache: URL | undefined;
let coreCache: CoreEnv | undefined;

/** رابط الموقع الأساسي (canonical، metadataBase). لا يتطلب بقية متغيرات المجموعة core. */
export function getAppUrl(): URL {
  appUrlCache ??= new URL(parseEnvGroup("app-url", appUrlSchema, process.env).APP_URL);
  return appUrlCache;
}

let securityCache: SecurityEnv | undefined;
let cloudinaryCache: CloudinaryEnv | undefined;

/** الرأس الموثوق لعنوان IP العميل (Vercel: x-forwarded-for، Nginx: x-real-ip). */
export function getTrustedProxyHeader(): "x-forwarded-for" | "x-real-ip" {
  return securityEnvSchema.shape.TRUSTED_PROXY_HEADER.catch("x-forwarded-for").parse(
    process.env.TRUSTED_PROXY_HEADER,
  );
}

export function getCoreEnv(): CoreEnv {
  coreCache ??= parseEnvGroup("core", coreEnvSchema, process.env);
  return coreCache;
}

export function getSecurityEnv(): SecurityEnv {
  securityCache ??= parseEnvGroup("security", securityEnvSchema, process.env);
  return securityCache;
}

export function getCloudinaryEnv(): CloudinaryEnv {
  cloudinaryCache ??= parseEnvGroup("cloudinary", cloudinaryEnvSchema, process.env);
  return cloudinaryCache;
}
