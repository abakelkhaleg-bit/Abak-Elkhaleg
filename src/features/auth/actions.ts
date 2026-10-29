"use server";

import { redirect } from "next/navigation";
import { actionError } from "@/lib/action-result";
import { loginSchema, safeAdminNextPath } from "@/schemas/auth";
import { login } from "@/server/auth/auth.service";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "@/server/auth/cookies";
import { deleteSession } from "@/server/auth/session";
import { getRequestContext } from "@/server/request-context";

export type LoginState = { error: string | null; username: string };

/** نموذج الدخول (useActionState). عند النجاح: جلسة جديدة دائمًا ثم تحويل لمسار إداري آمن. */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawUsername = formData.get("username");
  const username = typeof rawUsername === "string" ? rawUsername : "";
  const parsed = loginSchema.safeParse({ username: rawUsername, password: formData.get("password") });
  if (!parsed.success) {
    return { error: "أدخل اسم المستخدم وكلمة المرور.", username };
  }

  try {
    const { ip, userAgent } = await getRequestContext();
    const { token } = await login({ ...parsed.data, ip, userAgent });
    await writeSessionCookie(token);
  } catch (error) {
    return { error: actionError(error).error.message, username };
  }

  redirect(safeAdminNextPath(formData.get("next")));
}

/** تسجيل الخروج: يحذف الجلسة من القاعدة (يبطل التوكن فورًا) ثم يمسح الكوكي. */
export async function logoutAction(): Promise<void> {
  await deleteSession(await readSessionCookie());
  await clearSessionCookie();
  redirect("/admin/login");
}
