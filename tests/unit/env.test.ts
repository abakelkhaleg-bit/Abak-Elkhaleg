import { describe, expect, it } from "vitest";
import {
  EnvValidationError,
  cloudinaryEnvSchema,
  coreEnvSchema,
  parseEnvGroup,
  securityEnvSchema,
} from "@/lib/env";

describe("parseEnvGroup — core", () => {
  it("يقبل إعدادات صحيحة ويضبط NODE_ENV الافتراضي", () => {
    const env = parseEnvGroup("core", coreEnvSchema, {
      APP_URL: "https://example.com",
      MONGODB_URI: "mongodb://localhost:27017/abak",
    });
    expect(env.APP_URL).toBe("https://example.com");
    expect(env.NODE_ENV).toBe("development");
  });

  it("يفشل برسالة عربية تذكر كل متغير ناقص", () => {
    try {
      parseEnvGroup("core", coreEnvSchema, {});
      expect.unreachable("كان يجب أن يرمي خطأ");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as EnvValidationError).message;
      expect(message).toContain("إعدادات البيئة غير صحيحة (core)");
      expect(message).toContain("APP_URL");
      expect(message).toContain("MONGODB_URI");
    }
  });

  it("يرفض رابط MongoDB بصيغة غير صحيحة", () => {
    expect(() =>
      parseEnvGroup("core", coreEnvSchema, {
        APP_URL: "https://example.com",
        MONGODB_URI: "postgres://localhost/db",
      }),
    ).toThrow(/mongodb:\/\//);
  });

  it("يرفض APP_URL غير الكامل", () => {
    expect(() =>
      parseEnvGroup("core", coreEnvSchema, {
        APP_URL: "example.com",
        MONGODB_URI: "mongodb://localhost/db",
      }),
    ).toThrow(/APP_URL/);
  });
});

describe("parseEnvGroup — security & cloudinary", () => {
  it("يرفض salt قصيرًا", () => {
    expect(() =>
      parseEnvGroup("security", securityEnvSchema, {
        IP_HASH_SALT: "short",
        CRON_SECRET: "x".repeat(40),
      }),
    ).toThrow(/IP_HASH_SALT/);
  });

  it("يضبط TRUSTED_PROXY_HEADER افتراضيًا", () => {
    const env = parseEnvGroup("security", securityEnvSchema, {
      IP_HASH_SALT: "a".repeat(64),
      CRON_SECRET: "b".repeat(64),
    });
    expect(env.TRUSTED_PROXY_HEADER).toBe("x-forwarded-for");
  });

  it("يتطلب كل متغيرات Cloudinary", () => {
    expect(() =>
      parseEnvGroup("cloudinary", cloudinaryEnvSchema, { CLOUDINARY_CLOUD_NAME: "demo" }),
    ).toThrow(/CLOUDINARY_API_KEY[\s\S]*CLOUDINARY_API_SECRET/);
  });
});
