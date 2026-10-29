import AxeBuilder from "@axe-core/playwright";
import { collectConsoleErrors, expect, test } from "./fixtures";

test.describe("أساس الموقع", () => {
  test("الصفحة عربية RTL بالخط والشعار (R1)", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "ar");
    await expect(page).toHaveTitle("عطور عبق الخليج");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /الصفحة الرئيسية/ })).toBeVisible();

    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily.toLowerCase()).toContain("tajawal");

    expect(errors).toEqual([]);
  });

  test("لا يوجد تمرير أفقي (R2)", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("لا مخالفات وصول جسيمة (R3)", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("صفحة 404 حقيقية بالعربية", async ({ page }) => {
    const response = await page.goto("/صفحة-غير-موجودة");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible();
  });

  test("صفحة نظام التصميم غير متاحة في الإنتاج", async ({ page }) => {
    const response = await page.goto("/design-system");
    expect(response?.status()).toBe(404);
  });

  test("فحص الصحة يؤكد الاتصال ودعم المعاملات", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", db: "ok", transactions: true });
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("Security headers الأساسية موجودة", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("الأيقونات والأصول مولدة ومتاحة", async ({ request }) => {
    for (const url of ["/favicon.ico", "/brand/logo.webp", "/brand/og-default.jpg"]) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(200);
    }
  });
});
