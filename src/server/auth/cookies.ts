import "server-only";
import { cookies } from "next/headers";

/**
 * قراءة وكتابة كوكي الجلسة. معزولة في ملف واحد حتى يمكن استبدالها في الاختبارات.
 * __Host- يفرض Secure وPath=/ وعدم وجود Domain (docs/SECURITY.md §2.3).
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-abak_session" : "abak_session";

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function writeSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE_NAME, path: "/" });
}
