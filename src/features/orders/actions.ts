"use server";

import type { ActionResult } from "@/lib/action-result";
import { runAdminAction } from "@/server/auth/admin-action";
import { cancelOrder, confirmOrder, purgeOrderPii } from "@/server/orders.service";

/** عمليات الطلبات في الإدارة. كل دالة تمر عبر runAdminAction (تحقق الجلسة أولًا). */

export async function confirmOrderAction(id: unknown): Promise<ActionResult> {
  return runAdminAction(() => confirmOrder(id));
}

export async function cancelOrderAction(id: unknown): Promise<ActionResult> {
  return runAdminAction(() => cancelOrder(id));
}

export async function purgeOrderPiiAction(id: unknown): Promise<ActionResult> {
  return runAdminAction(() => purgeOrderPii(id));
}
