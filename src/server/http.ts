import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";
import { toAppError } from "@/lib/errors";

/** أدوات مشتركة لـ Route Handlers (Server Actions تفحص Origin تلقائيًا؛ هنا نفحصه يدويًا). */

/** حماية CSRF لمسارات الكتابة: Origin يجب أن يطابق أصل الموقع (docs/SECURITY.md §4). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === getAppUrl().origin;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  FILE_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  VALIDATION: 400,
  UNSUPPORTED_TYPE: 415,
  EMPTY_FILE: 400,
  UPLOAD_FAILED: 502,
};

export function jsonError(error: unknown): NextResponse {
  const appError = toAppError(error);
  return NextResponse.json(
    { ok: false, error: { code: appError.code, message: appError.message } },
    { status: STATUS_BY_CODE[appError.code] ?? 500, headers: { "Cache-Control": "no-store" } },
  );
}
