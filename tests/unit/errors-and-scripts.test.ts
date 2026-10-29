import { describe, expect, it } from "vitest";
import { AppError, toAppError, translateDuplicateKeyError } from "@/lib/errors";
import { databaseNameFromUri } from "../../scripts/_script-env";
import { assertSafeSeedTarget } from "../../scripts/seed/dev-data";

describe("ترجمة أخطاء قاعدة البيانات", () => {
  it("E11000 على slug أو SKU يعطي رسالة عربية مع الحقل", () => {
    const slug = translateDuplicateKeyError({ code: 11000, keyPattern: { slug: 1 } });
    expect(slug.message).toContain("الرابط (slug) مستخدم بالفعل");
    expect(slug.fieldErrors).toHaveProperty("slug");

    const sku = translateDuplicateKeyError({ code: 11000, keyPattern: { "variants.sku": 1 } });
    expect(sku.message).toContain("SKU");
  });

  it("toAppError لا يكشف تفاصيل الأخطاء غير المعروفة", () => {
    const error = toAppError(new Error("connection string mongodb://user:pass@host"));
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("INTERNAL");
    expect(error.message).not.toContain("mongodb");
  });

  it("toAppError يحوّل ValidationError إلى fieldErrors", () => {
    const error = toAppError({
      name: "ValidationError",
      errors: { "variants.0.price": { message: "السعر يجب أن يكون أكبر من صفر." } },
    });
    expect(error.code).toBe("VALIDATION");
    expect(error.fieldErrors).toEqual({ "variants.0.price": ["السعر يجب أن يكون أكبر من صفر."] });
  });
});

describe("حماية seed:dev", () => {
  it("يرفض بيئة الإنتاج دائمًا حتى مع --force-dev", () => {
    expect(() =>
      assertSafeSeedTarget({ nodeEnv: "production", databaseName: "abak-dev", force: true }),
    ).toThrow(/الإنتاج/);
  });

  it("يرفض قاعدة لا تنتهي بـ -dev/-test إلا بعلم صريح", () => {
    expect(() =>
      assertSafeSeedTarget({ nodeEnv: "development", databaseName: "abak-elkhalig", force: false }),
    ).toThrow(/-dev/);
    expect(() =>
      assertSafeSeedTarget({ nodeEnv: "development", databaseName: "abak-elkhalig", force: true }),
    ).not.toThrow();
    expect(() =>
      assertSafeSeedTarget({ nodeEnv: undefined, databaseName: "abak-elkhalig-dev", force: false }),
    ).not.toThrow();
  });

  it("يستخرج اسم القاعدة من الرابط دون بيانات الاعتماد", () => {
    expect(databaseNameFromUri("mongodb+srv://u:p@cluster0.x.net/abak-elkhalig-dev?retryWrites=true")).toBe(
      "abak-elkhalig-dev",
    );
    expect(databaseNameFromUri("mongodb://127.0.0.1:27017")).toBe("");
  });
});
