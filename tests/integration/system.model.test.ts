import { describe, expect, it } from "vitest";
import { isDuplicateKeyError, toAppError } from "@/lib/errors";
import { AdminModel } from "@/models/admin";
import { CounterModel, formatOrderReference, nextSequence } from "@/models/counter";
import { MediaAssetModel } from "@/models/media-asset";
import { RateLimitModel } from "@/models/rate-limit";
import { SessionModel } from "@/models/session";
import { loadStoreSettings, StoreSettingsModel } from "@/models/store-settings";
import { newObjectId, VALID_ARGON2_HASH } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

setupTestDatabase("system-model");

type IndexInfo = { key: Record<string, unknown>; expireAfterSeconds?: number; unique?: boolean };

describe("Admin", () => {
  it("لا يقبل كلمة مرور نصية صريحة — Argon2id فقط (A5 — طبقة القاعدة)", async () => {
    const plain = await AdminModel.create({ username: "owner", passwordHash: "MyPassword123!" }).catch(
      (e: unknown) => e,
    );
    expect(toAppError(plain).fieldErrors?.passwordHash?.join()).toContain("Argon2id");
  });

  it("حساب أدمن واحد فقط (A8 — طبقة القاعدة)", async () => {
    const admin = await AdminModel.create({ username: "Owner", passwordHash: VALID_ARGON2_HASH });
    expect(admin.username).toBe("owner");
    expect(admin.singleton).toBe("admin");

    const second = await AdminModel.create({ username: "other", passwordHash: VALID_ARGON2_HASH }).catch(
      (e: unknown) => e,
    );
    expect(isDuplicateKeyError(second)).toBe(true);
    expect(toAppError(second).message).toContain("يوجد حساب أدمن بالفعل");
  });

  it("passwordHash لا يُعاد في الاستعلامات افتراضيًا", async () => {
    await AdminModel.create({ username: "owner", passwordHash: VALID_ARGON2_HASH });
    const found = await AdminModel.findOne({ username: "owner" }).lean();
    expect(found).not.toHaveProperty("passwordHash");
  });
});

describe("Session / RateLimit (TTL)", () => {
  it("فهارس TTL وتفرد hash التوكن", async () => {
    const sessionIndexes = (await SessionModel.listIndexes()) as IndexInfo[];
    expect(sessionIndexes.find((i) => "expiresAt" in i.key)?.expireAfterSeconds).toBe(0);
    expect(sessionIndexes.find((i) => "tokenHash" in i.key)?.unique).toBe(true);

    const rateIndexes = (await RateLimitModel.listIndexes()) as IndexInfo[];
    expect(rateIndexes.find((i) => "expiresAt" in i.key)?.expireAfterSeconds).toBe(0);
  });

  it("يرفض توكن غير مُجزّأ (لا يُخزن التوكن الخام)", async () => {
    const raw = await SessionModel.create({
      tokenHash: "raw-token-value",
      adminId: newObjectId(),
      expiresAt: new Date(Date.now() + 1000),
    }).catch((e: unknown) => e);
    expect(toAppError(raw).fieldErrors).toHaveProperty("tokenHash");
  });
});

describe("StoreSettings", () => {
  it("لا ينشئ أكثر من مستند حتى مع 10 استدعاءات متزامنة", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => loadStoreSettings()));
    expect(new Set(results.map((settings) => settings._id))).toEqual(new Set(["store"]));
    expect(await StoreSettingsModel.countDocuments()).toBe(1);
    expect(results[0]?.storeName).toBe("عطور عبق الخليج");
  });

  it("يرفض رقم واتساب غير صالح ورابط بانر غير آمن", async () => {
    const settings = await loadStoreSettings();
    settings.whatsappNumber = "01012345678";
    settings.homepage.promoBanners.push({
      title: "عرض",
      href: "javascript:alert(1)",
      isActive: true,
      sortOrder: 0,
    });
    const error = await settings.save().catch((e: unknown) => e);
    const fields = Object.keys(toAppError(error).fieldErrors ?? {});
    expect(fields).toContain("whatsappNumber");
    expect(fields.some((field) => field.endsWith("href"))).toBe(true);
  });

  it("يقبل رقم واتساب بصيغة wa.me", async () => {
    const settings = await loadStoreSettings();
    settings.whatsappNumber = "201012345678";
    await expect(settings.save()).resolves.toBeDefined();
  });
});

describe("Counter", () => {
  it("يولد أرقامًا فريدة متتالية تحت التزامن", async () => {
    const values = await Promise.all(Array.from({ length: 50 }, () => nextSequence("order")));
    expect(new Set(values).size).toBe(50);
    expect([...values].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect((await CounterModel.findById("order").orFail()).seq).toBe(50);
  });

  it("formatOrderReference", () => {
    expect(formatOrderReference(123)).toBe("AK-000123");
    expect(formatOrderReference(1_234_567)).toBe("AK-1234567");
  });
});

describe("MediaAsset", () => {
  it("publicId فريد والحالة الافتراضية pending", async () => {
    const asset = {
      publicId: "abak-elkhalig/products/a1",
      secureUrl: "https://res.cloudinary.com/c/image/upload/abak-elkhalig/products/a1.webp",
      format: "webp",
      bytes: 1024,
      width: 800,
      height: 1000,
      folder: "products" as const,
    };
    const saved = await MediaAssetModel.create(asset);
    expect(saved.status).toBe("pending");
    const duplicate = await MediaAssetModel.create(asset).catch((e: unknown) => e);
    expect(isDuplicateKeyError(duplicate)).toBe(true);
  });
});
