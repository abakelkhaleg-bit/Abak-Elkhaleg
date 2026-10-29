import { NextResponse } from "next/server";
import { getSecurityEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { jsonError, safeEqual } from "@/server/http";
import { cleanupPendingMedia } from "@/server/media.service";

export const dynamic = "force-dynamic";

/**
 * تنظيف الصور المرفوعة التي لم تُربط بأي كيان خلال 24 ساعة.
 * يُستدعى من Vercel Cron أو crontab على VPS بالرأس: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  try {
    const expected = `Bearer ${getSecurityEnv().CRON_SECRET}`;
    if (!safeEqual(request.headers.get("authorization") ?? "", expected)) {
      throw new AppError("UNAUTHORIZED", "غير مصرح.");
    }
    const result = await cleanupPendingMedia();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
