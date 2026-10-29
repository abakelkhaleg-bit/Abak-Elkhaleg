import "server-only";
import type { z } from "zod";
import { validationError } from "@/lib/action-result";
import { AppError } from "@/lib/errors";

/** يتحقق من المدخلات بـ Zod ويرمي خطأ تحقق موحدًا (fieldErrors) عند الفشل. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error.issues);
  return result.data;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function assertObjectId(id: unknown, label = "العنصر"): string {
  if (typeof id !== "string" || !OBJECT_ID.test(id)) {
    throw new AppError("NOT_FOUND", `${label} غير موجود.`);
  }
  return id;
}
