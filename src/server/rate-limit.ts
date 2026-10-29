import "server-only";
import { createHash } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/errors";
import { RateLimitModel } from "@/models/rate-limit";
import { trusted } from "@/models/_mongoose";

/**
 * تحديد معدل المحاولات في MongoDB (يعمل على Vercel serverless وعلى VPS).
 * عداد لكل (حاوية، مفتاح) داخل نافذة زمنية ثابتة؛ TTL يحذف السجلات المنتهية.
 * المفاتيح تُخزن مُجزأة (لا عناوين IP أو أسماء مستخدمين نصية).
 */

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * 60 * 1000 },
  loginIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  order: { limit: 10, windowMs: 10 * 60 * 1000 },
  upload: { limit: 60, windowMs: 10 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

function keyFor(bucket: string, key: string): string {
  return `${bucket}:${createHash("sha256").update(key).digest("hex")}`;
}

export async function consumeRateLimit(
  bucket: string,
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  await connectToDatabase();
  const id = keyFor(bucket, key);
  const now = Date.now();

  for (let attempt = 0; ; attempt += 1) {
    try {
      // نافذة منتهية → تُحذف فتبدأ نافذة جديدة (TTL قد يتأخر حتى دقيقة).
      await RateLimitModel.deleteOne({ _id: id, expiresAt: trusted({ $lte: new Date(now) }) });
      const record = await RateLimitModel.findOneAndUpdate(
        { _id: id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now + rule.windowMs) } },
        { upsert: true, returnDocument: "after" },
      );
      if (!record) throw new Error("تعذر تحديث عداد المحاولات.");
      const allowed = record.count <= rule.limit;
      return {
        allowed,
        remaining: Math.max(0, rule.limit - record.count),
        retryAfterSeconds: allowed ? 0 : Math.ceil((record.expiresAt.getTime() - now) / 1000),
      };
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt >= 2) throw error;
    }
  }
}

export async function resetRateLimit(bucket: string, key: string): Promise<void> {
  await connectToDatabase();
  await RateLimitModel.deleteOne({ _id: keyFor(bucket, key) });
}
