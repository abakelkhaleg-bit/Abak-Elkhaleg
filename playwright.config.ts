import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  // خادم إنتاج واحد يخدم 4 عمّال بالتوازي (منها فحوص axe الثقيلة): اختبارات التنقل المتعدد تحتاج مهلة أطول.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "ar-EG",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /admin\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /admin\.spec\.ts/ },
    // اختبارات الإدارة تعدّل بيانات مشتركة (نشر/حذف/إعدادات) — تعمل بعد اختبارات المتجر.
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /admin\.spec\.ts/,
      dependencies: ["desktop", "mobile"],
    },
  ],
  webServer: {
    // يبني التطبيق ويشغّله على قاعدة MongoDB مؤقتة في الذاكرة (replica set).
    // react-server: نفس شرط تشغيل خادم Next حتى تعمل وحدات server-only داخل السكربت.
    command: "node --conditions=react-server --import tsx scripts/e2e-server.ts",
    url: `${baseURL}/api/health`,
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: { E2E_PORT: String(PORT) },
  },
});
