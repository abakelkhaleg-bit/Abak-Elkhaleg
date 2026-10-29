import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string({ error: "اسم المستخدم مطلوب." })
    .trim()
    .toLowerCase()
    .min(1, "اسم المستخدم مطلوب.")
    .max(64, "اسم المستخدم طويل جدًا."),
  password: z
    .string({ error: "كلمة المرور مطلوبة." })
    .min(1, "كلمة المرور مطلوبة.")
    .max(256, "كلمة المرور طويلة جدًا."),
});

/**
 * وجهة ما بعد الدخول: مسار داخلي في لوحة الإدارة فقط (منع Open Redirect).
 * أي قيمة أخرى (روابط خارجية، //، \، javascript:) تُستبدل بـ /admin.
 */
export function safeAdminNextPath(value: unknown): string {
  if (typeof value !== "string") return "/admin";
  const path = value.trim();
  if (!/^\/admin(\/[^\s\\]*)?(\?[^\s\\]*)?$/.test(path)) return "/admin";
  if (path.startsWith("/admin/login")) return "/admin";
  return path;
}
