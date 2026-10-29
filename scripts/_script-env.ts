/**
 * تهيئة بيئة السكربتات (tsx): تحميل .env.local إن وُجد، وقراءة رابط MongoDB.
 * السكربتات لا تستورد src/lib/db.ts لأنه مقيد بـ server-only (خاص بـ Next.js).
 */
import { existsSync } from "node:fs";
import path from "node:path";

export function loadScriptEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (existsSync(full)) process.loadEnvFile(full);
  }
}

export function requireMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error("MONGODB_URI غير مضبوط أو غير صالح. أضفه في .env.local (راجع .env.example).");
  }
  return uri;
}

/** اسم قاعدة البيانات من الرابط (بدون كشف بيانات الاعتماد). */
export function databaseNameFromUri(uri: string): string {
  const withoutQuery = uri.split("?")[0] ?? "";
  const afterHost = withoutQuery.replace(/^mongodb(\+srv)?:\/\/[^/]*/, "");
  return afterHost.replace(/^\//, "");
}
