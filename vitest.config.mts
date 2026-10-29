import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // "server-only" يرمي خطأ خارج React Server Components؛ في الاختبارات نستبدله بوحدة فارغة.
  "server-only": path.resolve(import.meta.dirname, "tests/setup/server-only-stub.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/setup/mongo-replset.global.ts"],
          // قاعدة واحدة مشتركة: نشغّل الملفات بالتتابع لتجنب التداخل بين الاختبارات
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
