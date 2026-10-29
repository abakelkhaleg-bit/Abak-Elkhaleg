import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./fixtures";
import { E2E } from "./e2e-data";

/** بيانات seed التطوير + بيانات E2E (tests/e2e/seed-e2e.ts). */
const OUD = { name: "عود ملكي", slug: "عود-ملكي" };
// slugify يحذف التشكيل فقط ويُبقي الهمزات كما هي (الرابط يطابق الاسم الأصلي)
const MUSK = { name: "مسك أبيض ناعم", slug: "مسك-أبيض-ناعم" };
const PUBLISHED_TOTAL = 6 + E2E.bulkCount;
const ar = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

/**
 * الفلاتر موجودة مرتين (صندوق جانبي ≥1024px، و<details> مطوية للجوال). نختار الحاوية حسب
 * عرض الشاشة صراحةً بدل :visible — محتوى <details> المغلقة غير موثوق في حساب الظهور.
 */
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function openFilters(page: Page) {
  if (isDesktop(page)) return;
  const details = page.getByTestId("filters-mobile");
  if ((await details.getAttribute("open")) === null) {
    await details.getByText("التصفية والترتيب").click();
  }
}

function visibleFilters(page: Page) {
  return page.getByTestId(isDesktop(page) ? "filters-desktop" : "filters-mobile").locator("form");
}

async function addToCart(page: Page, slug: string) {
  await page.goto(`/perfumes/${slug}`);
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await expect(page.getByRole("status").filter({ hasText: "تمت إضافة" })).toBeVisible();
}

test.describe("الصفحة الرئيسية والتنقل", () => {
  test("الأقسام تأتي من قاعدة البيانات وبطاقة المنتج تفتح صفحته", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "عطور مميزة" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "وصل حديثًا" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "العروض والخصومات" })).toBeVisible();
    await expect(page.getByRole("link", { name: "العود" }).first()).toBeAttached();

    await page.getByRole("link", { name: OUD.name }).first().click();
    await expect(page).toHaveURL(new RegExp(`/perfumes/${encodeURIComponent(OUD.slug)}$`));
    await expect(page.getByRole("heading", { level: 1, name: OUD.name })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("كل الروابط الداخلية في الرئيسية تعمل (لا روابط معطلة)", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href") ?? ""))]);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });
});

test.describe("قائمة العطور والفلترة", () => {
  test("العدد والترقيم على الخادم", async ({ page }) => {
    await page.goto("/perfumes");
    await expect(page.getByTestId("results-count")).toContainText(ar(PUBLISHED_TOTAL));
    await expect(page.getByTestId("results-count")).toContainText(`الصفحة ${ar(1)} من ${ar(2)}`);
    await expect(page.locator("main li article")).toHaveCount(24);

    await page.getByRole("link", { name: `الصفحة ${ar(2)}` }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("main li article")).toHaveCount(PUBLISHED_TOTAL - 24);
  });

  test("الفلترة بالتصنيف والترتيب بالسعر عبر النموذج، وإزالة الفلاتر", async ({ page }) => {
    await page.goto("/perfumes");
    await openFilters(page);
    const form = visibleFilters(page);
    await form.getByLabel("الترتيب").selectOption("price_asc");
    await form.getByRole("button", { name: "تطبيق" }).click();
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.locator("main li article h3").first()).toHaveText(MUSK.name);

    await openFilters(page);
    await visibleFilters(page).getByLabel("التصنيف").selectOption({ label: "العود" });
    await visibleFilters(page).getByRole("button", { name: "تطبيق" }).click();
    await expect(page.getByTestId("results-count")).toContainText(ar(1));
    await expect(page.locator("main li article h3")).toHaveText([OUD.name]);

    await openFilters(page);
    await visibleFilters(page).getByRole("link", { name: "إزالة الفلاتر" }).click();
    await expect(page).toHaveURL(/\/perfumes$/);
  });

  test("حالة عدم وجود نتائج واضحة", async ({ page }) => {
    await page.goto("/perfumes?min=999999");
    await expect(page.getByRole("heading", { name: "لا توجد عطور مطابقة" })).toBeVisible();
    await expect(page.getByRole("link", { name: "إزالة الفلاتر" }).last()).toBeVisible();
  });

  test("صفحة التصنيف وصفحة الماركة", async ({ page }) => {
    await page.goto(`/categories/${encodeURIComponent("المسك")}`);
    await expect(page.getByRole("heading", { level: 1, name: "المسك" })).toBeVisible();
    await expect(page.locator("main li article h3")).toHaveText([MUSK.name]);

    await page.goto("/brands");
    await page.getByRole("link", { name: "بيت العنبر" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "عطور بيت العنبر" })).toBeVisible();
    await expect(page.locator("main li article")).toHaveCount(2);
  });
});

test.describe("البحث", () => {
  test("بحث عربي بتطبيع الهمزات من الـHeader", async ({ page }) => {
    await page.goto("/");
    const input = page.locator('header input[name="q"]:visible');
    await input.fill("ابيض");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.locator("main li article h3")).toHaveText([MUSK.name]);
  });

  test("اقتراحات البحث", async ({ page }) => {
    await page.goto("/");
    await page.locator('header input[name="q"]:visible').fill("عنبر");
    const option = page.getByRole("option", { name: /عنبر الليل/ });
    await expect(option).toBeVisible();
    await option.getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name: "عنبر الليل" })).toBeVisible();
  });

  test("لا نتائج", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent("زززز")}`);
    await expect(page.getByRole("heading", { name: "لم نجد عطورًا مطابقة لبحثك" })).toBeVisible();
  });
});

test.describe("صفحة المنتج", () => {
  test("اختيار الحجم يغير السعر والتوفر (P10)، والحجم النافد لا يُضاف (P11)", async ({ page }) => {
    await page.goto(`/perfumes/${OUD.slug}`);
    const panel = page.locator("main article").first();
    const price = panel.getByTestId("price").first();
    const price50 = await price.textContent();
    await panel.getByRole("radio", { name: new RegExp(ar(100)) }).click();
    await expect(price).not.toHaveText(price50 ?? "");
    await expect(panel.getByRole("radio", { name: new RegExp(ar(100)) })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.goto(`/perfumes/${MUSK.slug}`);
    const muskPanel = page.locator("main article").first();
    // الحجم النافد معطل ولا يمكن اختياره أو إضافته؛ المتاح هو المحدد افتراضيًا
    const soldOut = muskPanel.getByRole("radio", { name: new RegExp(`${ar(75)}.*نفد`) });
    await expect(soldOut).toBeDisabled();
    await expect(soldOut).toHaveAttribute("aria-checked", "false");
    await expect(muskPanel.getByRole("radio", { name: new RegExp(ar(30)) })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(muskPanel.getByTestId("availability")).toHaveText("متوفر");
  });

  test("Breadcrumbs والمنتجات المرتبطة وcanonical", async ({ page }) => {
    await page.goto(`/perfumes/${OUD.slug}`);
    const crumbs = page.getByRole("navigation", { name: "مسار التنقل" });
    await expect(crumbs.getByRole("link", { name: "العود" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "قد يعجبك أيضًا" })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/perfumes/${encodeURIComponent(OUD.slug)}$`),
    );
  });

  test("404 للمنتج غير المنشور والقسم المخفي والرابط غير الموجود (E8)", async ({ page }) => {
    for (const url of [
      `/perfumes/${E2E.draftSlug}`,
      `/categories/${E2E.hiddenCategorySlug}`,
      "/brands/missing-brand",
      "/policies/missing",
    ]) {
      const response = await page.goto(url);
      expect(response?.status(), url).toBe(404);
    }
    await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible();
  });
});

test.describe("السلة", () => {
  test("الإضافة والعداد وتعديل الكمية والحذف — الأسعار من الخادم", async ({ page }) => {
    await page.goto(`/perfumes/${OUD.slug}`);
    await page.getByRole("button", { name: "زيادة الكمية" }).click();
    await expect(page.getByTestId("quantity")).toHaveText(ar(2));
    await page.getByRole("button", { name: "أضف إلى السلة" }).click();
    await expect(page.getByRole("status").filter({ hasText: "تمت إضافة" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText(ar(2));

    await page.goto("/cart");
    const line = page.getByTestId("cart-line");
    await expect(line).toHaveCount(1);
    await expect(line.getByTestId("line-quantity")).toHaveText(ar(2));
    const totalBefore = await page.getByTestId("cart-total").textContent();

    await page.getByRole("button", { name: `زيادة كمية ${OUD.name}` }).click();
    await expect(line.getByTestId("line-quantity")).toHaveText(ar(3));
    await expect(page.getByTestId("cart-total")).not.toHaveText(totalBefore ?? "");

    await page.getByRole("button", { name: "حذف" }).click();
    await expect(page.getByRole("heading", { name: "سلتك فارغة" })).toBeVisible();
  });

  test("السلة المعدّلة يدويًا في المتصفح تُصحَّح من الخادم", async ({ page }) => {
    await addToCart(page, OUD.slug);
    await page.evaluate(() => {
      const key = "abak-cart-v1";
      const items = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<Record<string, unknown>>;
      const first = items[0] ?? {};
      localStorage.setItem(
        key,
        JSON.stringify([
          { ...first, quantity: 999, price: 1 },
          { productId: "aaaaaaaaaaaaaaaaaaaaaaaa", variantId: "bbbbbbbbbbbbbbbbbbbbbbbb", quantity: 1 },
        ]),
      );
    });
    await page.goto("/cart");
    // مخزون عود ملكي 50ml = 12
    await expect(page.getByTestId("line-quantity")).toHaveText(ar(12));
    await expect(page.getByText("أُزيلت منتجات من السلة")).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem("abak-cart-v1"));
    expect(JSON.parse(stored ?? "[]")).toHaveLength(1);
  });

  test("زر الطلب معطل برسالة واضحة إن لم يُضبط رقم واتساب (W10)", async ({ page }) => {
    await addToCart(page, OUD.slug);
    await page.goto("/cart");
    const box = page.getByTestId("checkout-unavailable");
    await expect(box.getByRole("button", { name: "اطلب عبر واتساب" })).toBeDisabled();
    await expect(box).toContainText("رقم المتجر لم يُضبط بعد");
  });

  test("السلة الفارغة", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "سلتك فارغة" })).toBeVisible();
    await expect(page.getByRole("link", { name: "تصفح العطور" })).toBeVisible();
  });
});

test.describe("السياسات وSEO الأساسي", () => {
  test("صفحة السياسة من الإعدادات ورابطها في الـFooter", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: E2E.policy.title }).click();
    await expect(page.getByRole("heading", { level: 1, name: E2E.policy.title })).toBeVisible();
  });

  test("صفحات البحث والفلترة والسلة عليها noindex، والقائمة الأساسية لا", async ({ page }) => {
    for (const url of ["/search?q=عود", "/perfumes?sort=newest", "/cart"]) {
      await page.goto(url);
      await expect(page.locator('meta[name="robots"]'), url).toHaveAttribute("content", /noindex/);
    }
    await page.goto("/perfumes");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});

test.describe("الوصول والاستجابة", () => {
  test("axe بدون مخالفات serious/critical (R3)", async ({ page }) => {
    await addToCart(page, OUD.slug);
    for (const url of ["/", "/perfumes", `/perfumes/${OUD.slug}`, "/cart", "/brands"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(serious.map((v) => `${url} → ${v.id}: ${v.help}`)).toEqual([]);
    }
  });

  test("لا تمرير أفقي على شاشة 360px (R2)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const url of ["/", "/perfumes", `/perfumes/${OUD.slug}`, "/cart"]) {
      await page.goto(url);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, url).toBeLessThanOrEqual(0);
    }
  });
});
