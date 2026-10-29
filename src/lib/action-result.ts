import { AppError, toAppError, type FieldErrors } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** شكل موحد لنتائج Server Actions — رسائل عربية للواجهة دون تفاصيل تقنية. */
export type ActionError = { code: string; message: string; fieldErrors?: FieldErrors };
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(error: unknown): { ok: false; error: ActionError } {
  const appError = toAppError(error);
  if (appError.code === "INTERNAL" && !(error instanceof AppError)) {
    logger.error("خطأ غير متوقع في عملية", { error });
  }
  return {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
    },
  };
}

/** يحوّل أخطاء Zod إلى fieldErrors بنفس شكل أخطاء Mongoose. */
export function zodFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function validationError(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): AppError {
  return new AppError("VALIDATION", "تحقق من البيانات المدخلة.", zodFieldErrors(issues));
}
