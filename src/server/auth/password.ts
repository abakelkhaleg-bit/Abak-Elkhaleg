import "server-only";
import { hash, verify, type Algorithm } from "@node-rs/argon2";

/** Algorithm.Argon2id = 2 (const enum في الحزمة، لا يمكن استيراده كقيمة مع isolatedModules). */
const ARGON2ID = 2 as Algorithm;

/**
 * Argon2id بمعاملات توصية OWASP (docs/SECURITY.md §2.2).
 * كلمة المرور لا تُسجل ولا تُعاد ولا تُخزن نصًا أبدًا.
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * عند عدم وجود المستخدم نُجري تحققًا على hash وهمي حتى يتقارب زمن الاستجابة
 * ولا يكشف وجود اسم المستخدم من عدمه.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  await verifyPassword(await dummyHash, password);
  return false;
}

export function passwordPolicyErrors(password: string, username: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`كلمة المرور يجب ألا تقل عن ${PASSWORD_MIN_LENGTH} حرفًا.`);
  }
  if (password.toLowerCase() === username.toLowerCase()) {
    errors.push("كلمة المرور يجب ألا تساوي اسم المستخدم.");
  }
  if (password.length > 256) errors.push("كلمة المرور طويلة جدًا.");
  return errors;
}
