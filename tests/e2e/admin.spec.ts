import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { collectConsoleErrors, expect, test } from "./fixtures";
import { E2E } from "./e2e-data";

/** اختبارات لوحة الإدارة — تعمل بالتتابع لأنها تعدّل بيانات مشتركة. */
test.describe.configure({ mode: "serial" });

/** صورة PNG حقيقية بحجم 1×1 (يجتاز فحص النوع الفعلي على الخادم). */
const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** يسجل الدخول؛ مع كلمة المرور الصحيحة ينتظر الوصول للوحة التحكم (اكتمال الجلسة والكوكي). */
async function loginAsAdmin(page: Page, password: string = E2E.admin.password) {
  await page.goto("/admin/login");
  await page.getByLabel("اسم المستخدم").fill(E2E.admin.username);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "دخول" }).click();
  if (password === E2E.admin.password) {
    await expect(page.getByRole("heading", { level: 1, name: "لوحة التحكم" })).toBeVisible();
  }
}

function toast(page: Page, text: string | RegExp) {
  return page.getByRole("status").filter({ hasText: text });
}

test("صفحات الإدارة تحوّل لصفحة الدخول بدون جلسة (A1)", async ({ page, request }) => {
  for (const path of ["/admin", "/admin/products", "/admin/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/admin/login\\?next=${encodeURIComponent(path)}`));
    await expect(page.getByRole("heading", { name: "تسجيل دخول الإدارة" })).toBeVisible();
  }
  const response = await request.get("/admin", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});

test("كلمة مرور خاطئة ثم دخول صحيح مع كوكي آمنة (A10)", async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await loginAsAdmin(page, "Wrong-Password-123");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("اسم المستخدم أو كلمة المرور غير صحيحة.");

  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "لوحة التحكم" })).toBeVisible();
  await expect(page.getByText("إجمالي المنتجات")).toBeVisible();

  const cookie = (await context.cookies()).find((c) => c.name.includes("abak_session"));
  expect(cookie).toMatchObject({
    name: "__Host-abak_session",
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
    path: "/",
  });
  expect(errors).toEqual([]);
});

test("إضافة تصنيف وماركة ومنتج مع رسائل تحقق واضحة", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto("/admin/categories/new");
  await page.getByLabel("الاسم").fill("قسم الإدارة");
  await page.getByRole("button", { name: "إضافة التصنيف" }).click();
  await expect(toast(page, "أُضيف التصنيف.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect(page.getByRole("link", { name: "قسم الإدارة", exact: true })).toBeVisible();

  await page.goto("/admin/brands/new");
  await page.getByLabel("الاسم").fill("ماركة الإدارة");
  await page.getByRole("button", { name: "إضافة الماركة" }).click();
  await expect(toast(page, "أُضيفت الماركة.")).toBeVisible();

  await page.goto("/admin/products/new");
  await page.getByRole("button", { name: "إضافة المنتج" }).click();
  await expect(page.getByText("اسم العطر قصير جدًا.")).toBeVisible();

  await page.getByLabel("اسم العطر").fill("عطر من الإدارة");
  await page.getByLabel("التصنيف").selectOption({ label: "قسم الإدارة" });
  await page.getByLabel("الماركة").selectOption({ label: "ماركة الإدارة" });
  await page.getByLabel("الوصف المختصر").fill("عطر أُضيف من لوحة الإدارة");
  await page.getByLabel("الحجم (مل)").fill("75");
  await page.getByLabel(/^السعر \(ج\.م\)/).fill("450.50");
  await page.getByLabel("السعر قبل الخصم (ج.م)").fill("400");
  await page.getByRole("button", { name: "إضافة المنتج" }).click();
  await expect(page.getByText("السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي.")).toBeVisible();

  await page.getByLabel("السعر قبل الخصم (ج.م)").fill("");
  await page.getByLabel("الكمية الأولية").fill("6");
  await page.getByRole("button", { name: "إضافة المنتج" }).click();
  await expect(toast(page, "أُضيف المنتج.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "تعديل: عطر من الإدارة" })).toBeVisible();
  await expect(page.getByText("(المخزون الحالي: 6)")).toBeVisible();

  // النشر بدون صورة مرفوض برسالة واضحة (P12)
  await page.getByLabel("منشور في المتجر").check();
  await page.getByRole("button", { name: "حفظ التعديلات" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "بدون صورة" })).toBeVisible();
});

test("مدير الصور: رفع وترتيب بالأزرار ثم النشر بصورة", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/admin/products?q=${encodeURIComponent("عطر من الإدارة")}`);
  await page.getByTestId("admin-product-row").getByRole("link", { name: "تعديل" }).click();
  await expect(page.getByRole("heading", { name: "تعديل: عطر من الإدارة" })).toBeVisible();

  const manager = page.getByTestId("image-manager-products");
  await manager.getByLabel("إضافة الصور").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: Buffer.from(PNG_1PX, "base64") },
    { name: "b.png", mimeType: "image/png", buffer: Buffer.from(PNG_1PX, "base64") },
  ]);
  await expect(manager.getByTestId("managed-image")).toHaveCount(2);
  await expect(toast(page, "رُفعت 2 صورة")).toBeVisible();

  // ملف نصي بامتداد صورة يُرفض على الخادم برسالة واضحة (M2)
  await manager.getByLabel("إضافة الصور").setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("not really an image"),
  });
  await expect(toast(page, "نوع الملف غير مسموح")).toBeVisible();
  await expect(manager.getByTestId("managed-image")).toHaveCount(2);

  const second = manager.getByTestId("managed-image").nth(1);
  await second.getByLabel("النص البديل").fill("الصورة الثانية");
  await second.getByRole("button", { name: "اجعلها الرئيسية" }).click();
  await expect(manager.getByTestId("managed-image").first().getByLabel("النص البديل")).toHaveValue(
    "الصورة الثانية",
  );
  await expect(manager.getByTestId("managed-image").first().getByText("الرئيسية")).toBeVisible();

  await page.getByLabel("منشور في المتجر").check();
  await page.getByRole("button", { name: "حفظ التعديلات" }).click();
  await expect(toast(page, "حُفظت التعديلات.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("managed-image")).toHaveCount(2);
  await expect(page.getByTestId("managed-image").first().getByLabel("النص البديل")).toHaveValue(
    "الصورة الثانية",
  );
});

test("نشر منتج يظهره في المتجر وإيقافه يعيد 404 (P8)", async ({ page, request }) => {
  await loginAsAdmin(page);
  expect((await request.get(`/perfumes/${E2E.adminDraft.slug}`)).status()).toBe(404);

  await page.goto(`/admin/products?q=${encodeURIComponent(E2E.adminDraft.name)}`);
  const row = page.getByTestId("admin-product-row").filter({ hasText: E2E.adminDraft.name });
  await row.getByRole("button", { name: "نشر", exact: true }).click();
  await expect(toast(page, "نُشر المنتج.")).toBeVisible();
  await expect(row.getByText("منشور", { exact: true })).toBeVisible();
  expect((await request.get(`/perfumes/${E2E.adminDraft.slug}`)).status()).toBe(200);

  await row.getByRole("button", { name: "إيقاف النشر" }).click();
  await expect(toast(page, "أُوقف نشر المنتج.")).toBeVisible();
  expect((await request.get(`/perfumes/${E2E.adminDraft.slug}`)).status()).toBe(404);
});

test("حذف تصنيف مرتبط بمنتجات مرفوض، وحذف المنتج بعد التأكيد (P13)", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/categories");
  const row = page
    .getByTestId("taxonomy-row")
    .filter({ has: page.getByRole("link", { name: "قسم الإدارة", exact: true }) });
  await row.getByRole("button", { name: "حذف" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(toast(page, "لا يمكن حذف التصنيف لأنه مرتبط بـ1 منتج")).toBeVisible();

  await page.goto(`/admin/products?q=${encodeURIComponent("عطر من الإدارة")}`);
  const productRow = page.getByTestId("admin-product-row").filter({ hasText: "عطر من الإدارة" });
  await productRow.getByRole("button", { name: "حذف" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(toast(page, "حُذف المنتج.")).toBeVisible();
  await expect(page.getByText("لا توجد منتجات مطابقة.")).toBeVisible();

  // بعد حذف المنتج يصبح حذف التصنيف ممكنًا
  await page.goto("/admin/categories");
  await row.getByRole("button", { name: "حذف" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(toast(page, "حُذف التصنيف.")).toBeVisible();
});

test("إعدادات المتجر تنعكس على المتجر (واتساب والسياسات)", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/settings");
  await page.getByLabel("رقم واتساب لاستقبال الطلبات").fill("abc");
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await expect(page.getByText("أدخل رقم واتساب مصري صحيح")).toBeVisible();

  await page.getByLabel("رقم واتساب لاستقبال الطلبات").fill("010 1234 5678");
  await page.getByRole("button", { name: "إضافة صفحة" }).click();
  const policy = page.locator("fieldset").filter({ hasText: "صفحة 2" });
  await policy.getByLabel("العنوان").fill("سياسة الاستبدال");
  await policy.getByLabel("الرابط").fill("returns");
  await policy.getByLabel("المحتوى").fill("يمكن استبدال العطر غير المفتوح خلال 7 أيام.");
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await expect(toast(page, "حُفظت إعدادات المتجر.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("رقم واتساب لاستقبال الطلبات")).toHaveValue("01012345678");
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "سياسة الاستبدال" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "سياسة الاستبدال" })).toBeVisible();
});

test("الطلب عبر واتساب ثم تأكيده وإلغاؤه من الإدارة (W8، S6، S13)", async ({ page }) => {
  await page.goto("/perfumes/عود-ملكي");
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await expect(toast(page, "تمت إضافة")).toBeVisible();
  await page.goto("/cart");

  await page.getByLabel("الاسم").fill("عميل الاختبار");
  await page.getByLabel("رقم الموبايل").fill("0123");
  await page.getByLabel("المحافظة").selectOption({ label: "الجيزة" });
  await page.getByRole("button", { name: "اطلب عبر واتساب" }).click();
  await expect(page.getByText("أدخل رقم موبايل مصري صحيح")).toBeVisible();

  await page.getByLabel("رقم الموبايل").fill("01122334455");
  await page.getByLabel("ملاحظات (اختياري)").fill("التسليم مساءً");
  await page.getByRole("button", { name: "اطلب عبر واتساب" }).click();

  const created = page.getByTestId("checkout-created");
  const reference = (await created.getByTestId("order-reference").textContent()) ?? "";
  expect(reference).toMatch(/^AK-\d{6}$/);
  const link = created.getByTestId("open-whatsapp");
  const href = (await link.getAttribute("href")) ?? "";
  expect(href).toMatch(/^https:\/\/wa\.me\/201012345678\?text=/);
  const text = new URL(href).searchParams.get("text") ?? "";
  for (const part of [reference, "عود ملكي", "عميل الاختبار", "01122334455", "الجيزة", "التسليم مساءً"]) {
    expect(text).toContain(part);
  }
  await expect(created).toContainText("لا يصل للمتجر إلا بعد أن تضغط «إرسال» في واتساب");
  const body = (await page.locator("body").textContent()) ?? "";
  expect(body).not.toContain("تم إرسال طلبك");
  expect(body).not.toContain("تم تأكيد طلبك");

  await loginAsAdmin(page);
  await page.goto(`/admin/orders?q=${reference}`);
  const row = page.getByTestId("order-row").filter({ hasText: reference });
  await expect(row.getByText("مفتوح في واتساب")).toBeVisible();
  await expect(row).toContainText("عميل الاختبار");

  await row.getByRole("button", { name: "تأكيد الطلب" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(toast(page, "أُكد الطلب وخُصم المخزون.")).toBeVisible();
  await expect(row.getByText("مؤكد", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "إلغاء" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(toast(page, "أُلغي الطلب.")).toBeVisible();
  await expect(row.getByText("ملغى", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "حذف بيانات العميل" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(toast(page, "حُذفت بيانات العميل.")).toBeVisible();
  await expect(row).not.toContainText("عميل الاختبار");

  await page.goto("/admin/inventory/movements");
  await expect(page.getByTestId("movement-row").first()).toContainText("إرجاع (إلغاء طلب)");
});

test("تسجيل الخروج يبطل الجلسة (A6)", async ({ page, context }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin$/);
  const before = (await context.cookies()).find((c) => c.name === "__Host-abak_session");
  if (!before) throw new Error("لا توجد كوكي جلسة بعد الدخول");
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);

  // إعادة استخدام التوكن القديم لا تعمل (الجلسة حُذفت من القاعدة)
  await context.addCookies([before]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("تحديد معدل محاولات الدخول (A4)", async ({ page }) => {
  await page.goto("/admin/login");
  for (let i = 0; i < 5; i += 1) {
    await page.getByLabel("اسم المستخدم").fill("ghost-user");
    await page.getByLabel("كلمة المرور").fill("Wrong-Password-123");
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("غير صحيحة");
  }
  await page.getByLabel("كلمة المرور").fill("Wrong-Password-123");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("محاولات كثيرة");
});

test("المخزون: توريد، وتعديل بسبب إلزامي، وجرد يفتح تنبيه النفاد (S9، S2)", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/admin/inventory?q=${encodeURIComponent(E2E.adminDraft.name)}`);
  const row = page.getByTestId("inventory-row").filter({ hasText: E2E.adminDraft.name });
  await expect(row.getByTestId("stock-quantity")).toHaveText("٥");
  const controls = row.getByTestId("stock-controls");
  await controls.getByText("تعديل المخزون").click();

  await controls.getByLabel("الكمية المضافة").fill("4");
  await controls.getByRole("button", { name: "تنفيذ" }).click();
  await expect(toast(page, "المخزون 5 ← 9")).toBeVisible();
  await expect(row.getByTestId("stock-quantity")).toHaveText("٩");

  await controls.getByLabel("نوع العملية").selectOption("adjustment");
  await controls.getByLabel(/التغيير/).fill("-2");
  await controls.getByRole("button", { name: "تنفيذ" }).click();
  await expect(controls.getByText("سبب التعديل مطلوب.")).toBeVisible();
  await expect(row.getByTestId("stock-quantity")).toHaveText("٩");

  await controls.getByLabel(/^السبب/).fill("زجاجة مكسورة");
  await controls.getByRole("button", { name: "تنفيذ" }).click();
  await expect(toast(page, "المخزون 9 ← 7")).toBeVisible();

  await controls.getByLabel("نوع العملية").selectOption("stocktake");
  await controls.getByLabel("الكمية الفعلية المعدودة").fill("0");
  await controls.getByLabel(/^السبب/).fill("جرد آخر الشهر");
  await controls.getByRole("button", { name: "تنفيذ" }).click();
  await expect(toast(page, "المخزون 7 ← 0")).toBeVisible();
  await expect(row.getByText("نافد")).toBeVisible();

  await row.getByRole("link", { name: "السجل" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "سجل حركات المخزون" })).toBeVisible();
  const movements = page.getByTestId("movement-row");
  await expect(movements).toHaveCount(3);
  await expect(movements.first()).toContainText("جرد آخر الشهر");
  await expect(movements.nth(1)).toContainText("زجاجة مكسورة");

  await page.getByRole("navigation", { name: "قائمة الإدارة" }).getByRole("link", { name: "التنبيهات" }).click();
  const alert = page.getByTestId("notification-row").filter({ hasText: "نفد المخزون" });
  await expect(alert).toContainText(E2E.adminDraft.name);
  await alert.getByRole("button", { name: "تعليم كمقروء" }).click();
  await expect(toast(page, "عُلّم التنبيه كمقروء.")).toBeVisible();
  await expect(alert.getByText("غير مقروء")).toHaveCount(0);
  await expect(alert.getByRole("link", { name: "تعديل المنتج" })).toHaveAttribute(
    "href",
    /\/admin\/products\/[a-f0-9]{24}$/,
  );
});

test("صفحات الإدارة بدون مخالفات وصول جسيمة", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin$/);
  for (const path of [
    "/admin",
    "/admin/products",
    "/admin/products/new",
    "/admin/categories",
    "/admin/settings",
    "/admin/inventory",
    "/admin/inventory/movements",
    "/admin/notifications",
    "/admin/orders",
  ]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map(
        (v) =>
          `${path} → ${v.id}: ${v.nodes
            .map((n) => `${n.target.join(" ")} (${n.any[0]?.message ?? ""})`)
            .join(" | ")}`,
      ),
    ).toEqual([]);
  }
});
