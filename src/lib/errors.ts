/**
 * أخطاء مجال موحدة برسائل عربية للمستخدم. التفاصيل التقنية تبقى في سجلات الخادم.
 */

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

type DuplicateKeyError = {
  code: 11000;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
};

export function isDuplicateKeyError(error: unknown): error is DuplicateKeyError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

const DUPLICATE_MESSAGES: Record<string, { field: string; message: string }> = {
  slug: { field: "slug", message: "الرابط (slug) مستخدم بالفعل، اختر رابطًا آخر." },
  "variants.sku": { field: "variants", message: "رمز SKU مستخدم بالفعل في منتج آخر." },
  nameKey: { field: "name", message: "هذا الاسم مستخدم بالفعل." },
  singleton: { field: "username", message: "يوجد حساب أدمن بالفعل؛ لا يُسمح إلا بحساب واحد." },
  username: { field: "username", message: "اسم المستخدم مستخدم بالفعل." },
  reference: { field: "reference", message: "الرقم المرجعي مكرر." },
  publicId: { field: "publicId", message: "هذه الصورة مسجلة بالفعل." },
  tokenHash: { field: "session", message: "تعذر إنشاء الجلسة، حاول مرة أخرى." },
};

/** يحوّل خطأ E11000 إلى AppError برسالة عربية حسب الفهرس الذي تسبب فيه. */
export function translateDuplicateKeyError(error: DuplicateKeyError): AppError {
  const keys = Object.keys(error.keyPattern ?? error.keyValue ?? {});
  const known = keys.map((key) => DUPLICATE_MESSAGES[key]).find(Boolean);
  if (known) {
    return new AppError("DUPLICATE", known.message, { [known.field]: [known.message] });
  }
  return new AppError("DUPLICATE", "القيمة مستخدمة بالفعل.");
}

type MongooseValidationError = {
  name: "ValidationError";
  errors: Record<string, { message: string }>;
};

export function isValidationError(error: unknown): error is MongooseValidationError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "ValidationError" &&
    typeof (error as { errors?: unknown }).errors === "object"
  );
}

/** يحوّل ValidationError من Mongoose إلى fieldErrors. */
export function translateValidationError(error: MongooseValidationError): AppError {
  const fieldErrors: FieldErrors = {};
  for (const [path, detail] of Object.entries(error.errors)) {
    (fieldErrors[path] ??= []).push(detail.message);
  }
  return new AppError("VALIDATION", "تحقق من البيانات المدخلة.", fieldErrors);
}

/** نقطة واحدة لترجمة أخطاء قاعدة البيانات المعروفة. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isDuplicateKeyError(error)) return translateDuplicateKeyError(error);
  if (isValidationError(error)) return translateValidationError(error);
  return new AppError("INTERNAL", "حدث خطأ غير متوقع، حاول مرة أخرى.");
}
