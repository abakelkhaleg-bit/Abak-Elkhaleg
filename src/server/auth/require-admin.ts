import "server-only";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { readSessionCookie } from "@/server/auth/cookies";
import { validateSessionToken, type AdminIdentity } from "@/server/auth/session";

/**
 * التحقق الحقيقي من الصلاحية. يُستدعى في كل صفحة إدارة وكل Server Action وكل Route إداري.
 * proxy.ts يقوم بتحويل مبدئي فقط ولا يُعتمد عليه كحماية.
 */

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  return validateSessionToken(await readSessionCookie());
}

/** للـServer Actions والـRoutes: يرمي UNAUTHORIZED. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new AppError("UNAUTHORIZED", "انتهت الجلسة أو لم تسجل الدخول. سجّل الدخول مجددًا.");
  }
  return admin;
}

/** لصفحات الإدارة: يحوّل إلى صفحة الدخول مع الرجوع لنفس الصفحة بعد الدخول. */
export async function requireAdminPage(currentPath = "/admin"): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent(currentPath)}`);
  return admin;
}
