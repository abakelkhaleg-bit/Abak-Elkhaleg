import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { AdminModel } from "@/models/admin";
import { SessionModel } from "@/models/session";
import { SESSION_MAX_AGE_SECONDS } from "@/server/auth/cookies";

/**
 * جلسات الأدمن في MongoDB (docs/decisions/0005-auth-db-sessions.md).
 * التوكن الخام يذهب إلى الكوكي فقط؛ القاعدة تخزن SHA-256 له.
 */

export const SESSION_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export type AdminIdentity = { id: string; username: string };

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  adminId: Types.ObjectId,
  userAgent: string | null,
): Promise<string> {
  await connectToDatabase();
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await SessionModel.create({
    tokenHash: hashSessionToken(token),
    adminId,
    expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000),
    lastSeenAt: new Date(now),
    ...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {}),
  });
  return token;
}

/**
 * يعيد هوية الأدمن إن كانت الجلسة صالحة: موجودة، غير منتهية، غير خاملة أكثر من 24 ساعة،
 * وأُنشئت بعد آخر تغيير لكلمة المرور.
 */
export async function validateSessionToken(token: string | null): Promise<AdminIdentity | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  await connectToDatabase();
  const session = await SessionModel.findOne({ tokenHash: hashSessionToken(token) });
  if (!session) return null;

  const now = Date.now();
  const expired = session.expiresAt.getTime() <= now;
  const idle = now - session.lastSeenAt.getTime() > SESSION_IDLE_TIMEOUT_MS;
  if (expired || idle) {
    await SessionModel.deleteOne({ _id: session._id });
    return null;
  }

  const admin = await AdminModel.findById(session.adminId, { username: 1, passwordChangedAt: 1 });
  if (!admin || session.createdAt.getTime() < admin.passwordChangedAt.getTime()) {
    await SessionModel.deleteOne({ _id: session._id });
    return null;
  }

  if (now - session.lastSeenAt.getTime() > LAST_SEEN_UPDATE_INTERVAL_MS) {
    await SessionModel.updateOne({ _id: session._id }, { lastSeenAt: new Date(now) });
  }
  return { id: admin._id.toString(), username: admin.username };
}

export async function deleteSession(token: string | null): Promise<void> {
  if (!token) return;
  await connectToDatabase();
  await SessionModel.deleteOne({ tokenHash: hashSessionToken(token) });
}

export async function deleteAllSessions(adminId: Types.ObjectId | string): Promise<number> {
  await connectToDatabase();
  const result = await SessionModel.deleteMany({ adminId });
  return result.deletedCount;
}
