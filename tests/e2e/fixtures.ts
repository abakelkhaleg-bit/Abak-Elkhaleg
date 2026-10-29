import path from "node:path";
import { test as base, expect } from "@playwright/test";

/**
 * كل صور Cloudinary في الاختبارات تُخدم من ملف محلي — الاختبارات لا تعتمد على الإنترنت
 * ولا تُنتج أخطاء Console بسبب الشبكة.
 */
const PLACEHOLDER = path.join(process.cwd(), "public", "brand", "placeholder.webp");

export const test = base.extend({
  // اسم المعامل provide (وليس use) حتى لا تخلطه قاعدة react-hooks بـ React.use
  page: async ({ page }, provide) => {
    await page.route("https://res.cloudinary.com/**", (route) =>
      route.fulfill({ path: PLACEHOLDER, contentType: "image/webp" }),
    );
    await provide(page);
  },
});

export { expect };

/** يجمع أخطاء Console أثناء الاختبار. */
export function collectConsoleErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
