import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminModel } from "@/models/admin";
import { CategoryModel } from "@/models/category";
import { SessionModel } from "@/models/session";
import { createRefs } from "../setup/factories";
import { setupTestDatabase } from "../setup/test-db";

/** الكوكي وسياق الطلب يعتمدان على Next.js؛ نستبدلهما بحاوية في الذاكرة. */
const jar = vi.hoisted(() => ({ token: null as string | null, ip: "203.0.113.7" }));

vi.mock("@/server/auth/cookies", () => ({
  SESSION_COOKIE_NAME: "abak_session",
  SESSION_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
  readSessionCookie: async () => jar.token,
  writeSessionCookie: async (token: string) => {
    jar.token = token;
  },
  clearSessionCookie: async () => {
    jar.token = null;
  },
}));

vi.mock("@/server/request-context", () => ({
  getRequestContext: async () => ({ ip: jar.ip, userAgent: "vitest" }),
}));

const { loginAction, logoutAction } = await import("@/features/auth/actions");
const catalogActions = await import("@/features/catalog/actions");
const settingsActions = await import("@/features/settings/actions");
const inventoryActions = await import("@/features/inventory/actions");
const orderActions = await import("@/features/orders/actions");
const { createInitialAdmin, resetAdminPassword } = await import(
  "@/server/auth/admin-account.service"
);
const { validateSessionToken, SESSION_IDLE_TIMEOUT_MS } = await import("@/server/auth/session");
const { verifyPassword } = await import("@/server/auth/password");

setupTestDatabase("auth");

const USERNAME = "owner";
const PASSWORD = "Correct-Horse-Battery-9";
const initialState = { error: null, username: "" };

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

/** loginAction ينتهي بـ redirect عند النجاح (خطأ NEXT_REDIRECT يحمل المسار في digest). */
async function login(password = PASSWORD, username = USERNAME, next = "/admin/products") {
  try {
    const state = await loginAction(initialState, form({ username, password, next }));
    return { state, redirect: null };
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT")) throw error;
    return { state: null, redirect: digest.split(";")[2] ?? "" };
  }
}

beforeEach(() => {
  jar.token = null;
  jar.ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
});

describe("حساب الأدمن", () => {
  it("كلمة المرور تُخزن Argon2id ولا تُخزن نصًا (A5)", async () => {
    await createInitialAdmin({ username: USERNAME, password: PASSWORD });
    const admin = await AdminModel.findOne().select("+passwordHash").orFail();
    expect(admin.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(admin.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(admin.passwordHash, PASSWORD)).toBe(true);
    expect(await verifyPassword(admin.passwordHash, "wrong-password-123")).toBe(false);
  });

  it("لا يُسمح بأدمن ثانٍ، وتُرفض كلمة المرور الضعيفة (A8)", async () => {
    await expect(createInitialAdmin({ username: "a", password: PASSWORD })).rejects.toThrow(/3–32/);
    await expect(createInitialAdmin({ username: USERNAME, password: "short" })).rejects.toThrow(/12/);
    await createInitialAdmin({ username: USERNAME, password: PASSWORD });
    await expect(
      createInitialAdmin({ username: "second", password: "Another-Strong-Pass-1" }),
    ).rejects.toMatchObject({ code: "ADMIN_EXISTS" });
    expect(await AdminModel.countDocuments()).toBe(1);
  });
});

describe("الدخول والجلسات", () => {
  beforeEach(async () => {
    await createInitialAdmin({ username: USERNAME, password: PASSWORD });
  });

  it("دخول صحيح ينشئ جلسة (hash فقط في القاعدة) ويحوّل لمسار آمن", async () => {
    const result = await login();
    expect(result.redirect).toBe("/admin/products");
    expect(jar.token).toBeTruthy();
    const session = await SessionModel.findOne().orFail();
    expect(session.tokenHash).not.toBe(jar.token);
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await validateSessionToken(jar.token)).toMatchObject({ username: USERNAME });

    const external = await login(PASSWORD, USERNAME, "https://evil.example");
    expect(external.redirect).toBe("/admin");
  });

  it("رسالة واحدة لكلمة مرور خاطئة أو مستخدم غير موجود", async () => {
    const wrong = await login("Wrong-Password-123");
    const unknown = await login(PASSWORD, "nobody");
    expect(wrong.state?.error).toBe("اسم المستخدم أو كلمة المرور غير صحيحة.");
    expect(unknown.state?.error).toBe(wrong.state?.error);
    expect(jar.token).toBeNull();
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it("يحد محاولات الدخول: السادسة مرفوضة حتى بكلمة مرور صحيحة (A4)", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await login("Wrong-Password-123")).state?.error).toContain("غير صحيحة");
    }
    const sixth = await login();
    expect(sixth.state?.error).toContain("محاولات كثيرة");
    expect(jar.token).toBeNull();

    // عنوان IP آخر غير متأثر
    jar.ip = "198.51.100.1";
    expect((await login()).redirect).toBe("/admin/products");
  });

  it("يرفض الجلسات المزورة والخاملة والمنتهية (A3)", async () => {
    await login();
    const token = jar.token;
    expect(await validateSessionToken(token)).not.toBeNull();
    expect(await validateSessionToken("forged-token-value-that-does-not-exist")).toBeNull();
    expect(await validateSessionToken(null)).toBeNull();

    await SessionModel.updateMany(
      {},
      { lastSeenAt: new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS - 1000) },
    );
    expect(await validateSessionToken(token)).toBeNull();
    expect(await SessionModel.countDocuments()).toBe(0);

    await login();
    await SessionModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect(await validateSessionToken(jar.token)).toBeNull();
  });

  it("تغيير كلمة المرور يبطل كل الجلسات (A3)", async () => {
    await login();
    const oldToken = jar.token;
    const result = await resetAdminPassword({ password: "Brand-New-Password-2" });
    expect(result.sessionsRevoked).toBe(1);
    expect(await validateSessionToken(oldToken)).toBeNull();
    expect((await login()).state?.error).toContain("غير صحيحة");
    expect((await login("Brand-New-Password-2")).redirect).toBeTruthy();
  });

  it("تسجيل الخروج يحذف الجلسة من القاعدة ويبطل التوكن (A6)", async () => {
    await login();
    const token = jar.token;
    await expect(logoutAction()).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/login"),
    });
    expect(jar.token).toBeNull();
    expect(await SessionModel.countDocuments()).toBe(0);
    expect(await validateSessionToken(token)).toBeNull();
  });
});

describe("حماية العمليات الإدارية (A2)", () => {
  it("كل Server Action إدارية ترفض الاستدعاء بدون جلسة ولا تغيّر البيانات", async () => {
    const refs = await createRefs();
    const categoriesBefore = await CategoryModel.countDocuments();
    const modules = { ...catalogActions, ...settingsActions, ...inventoryActions, ...orderActions };
    type AnyAction = (...args: unknown[]) => Promise<unknown>;
    const actions = Object.entries(modules).filter(
      ([, value]) => typeof value === "function",
    ) as unknown as Array<[string, AnyAction]>;
    expect(actions.length).toBeGreaterThanOrEqual(17);

    for (const [name, action] of actions) {
      const result = await action("category", refs.categoryId.toString(), { name: "اختراق" });
      expect(result, name).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    }
    expect(await CategoryModel.countDocuments()).toBe(categoriesBefore);
  });

  it("الجلسة المزورة في الكوكي لا تمنح صلاحية", async () => {
    jar.token = "x".repeat(43);
    const result = await catalogActions.createTaxonomyAction("category", { name: "اختراق" });
    expect(result).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });
});
