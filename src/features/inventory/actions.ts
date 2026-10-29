"use server";

import type { ActionResult } from "@/lib/action-result";
import { runAdminAction } from "@/server/auth/admin-action";
import {
  applyStockOperation,
  setLowStockThreshold,
  type StockChangeResult,
} from "@/server/inventory.service";
import { markAllNotificationsRead, markNotificationRead } from "@/server/notifications.service";

/**
 * عمليات المخزون والتنبيهات. كل دالة تمر عبر runAdminAction (تحقق الجلسة أولًا)،
 * والمدخلات غير موثوقة: تتحقق منها الخدمات بـ Zod داخل معاملة.
 */

export async function applyStockOperationAction(
  input: unknown,
): Promise<ActionResult<StockChangeResult>> {
  return runAdminAction(() => applyStockOperation(input));
}

export async function setLowStockThresholdAction(input: unknown): Promise<ActionResult> {
  return runAdminAction(() => setLowStockThreshold(input));
}

export async function markNotificationReadAction(id: unknown): Promise<ActionResult> {
  return runAdminAction(() => markNotificationRead(id));
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<number>> {
  return runAdminAction(() => markAllNotificationsRead());
}
