/**
 * سجل بسيط يحذف القيم الحساسة تلقائيًا قبل الكتابة (docs/SECURITY.md §9).
 */

const SENSITIVE_KEY =
  /pass(word)?|token|cookie|authorization|secret|api[-_]?key|phone|address|mongodb_uri|uri/i;

const REDACTED = "[محذوف]";

type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[عميق جدًا]";
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(inner, depth + 1);
    }
    return output;
  }
  return value;
}

/** يزيل بيانات الاعتماد المضمنة في روابط الاتصال إن ظهرت داخل نص خطأ. */
function redactString(text: string): string {
  return text.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, `$1${REDACTED}@`);
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? { context: redact(context) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
