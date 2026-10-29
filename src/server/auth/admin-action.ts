import "server-only";
import { unstable_rethrow } from "next/navigation";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/server/auth/require-admin";
import type { AdminIdentity } from "@/server/auth/session";

/**
 * غلاف إلزامي لكل Server Action إدارية: يتحقق من الجلسة أولًا ثم ينفذ، ويحوّل الأخطاء
 * إلى نتيجة موحدة. أخطاء التحويل (redirect/notFound) تُعاد كما هي ليتعامل معها Next.js.
 */
export async function runAdminAction<T>(
  handler: (admin: AdminIdentity) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const admin = await requireAdmin();
    return actionOk(await handler(admin));
  } catch (error) {
    unstable_rethrow(error);
    return actionError(error);
  }
}
