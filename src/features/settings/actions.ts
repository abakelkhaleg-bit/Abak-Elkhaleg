"use server";

import type { ActionResult } from "@/lib/action-result";
import { updateSettings } from "@/server/admin/settings.admin.service";
import { runAdminAction } from "@/server/auth/admin-action";

/** حفظ إعدادات المتجر (للأدمن فقط). */
export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  return runAdminAction(() => updateSettings(input));
}
