"use client";

import { startTransition, useActionState, useRef } from "react";
import { buttonClass, inputClass } from "@/components/admin/ui";
import { loginAction, type LoginState } from "@/features/auth/actions";

const INITIAL: LoginState = { error: null, username: "" };

/**
 * نموذج الدخول. الإرسال عبر onSubmit (وليس action={...}) لأن React 19 يعيد ضبط كل حقول
 * النموذج بعد action، فيُمسح اسم المستخدم بعد كل محاولة فاشلة. هنا نمسح كلمة المرور فقط.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL);
  const passwordRef = useRef<HTMLInputElement>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (passwordRef.current) passwordRef.current.value = "";
    startTransition(() => formAction(data));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium text-espresso">
          اسم المستخدم
        </label>
        <input
          id="username"
          name="username"
          type="text"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-espresso">
          كلمة المرور
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={isPending} className={`${buttonClass.primary} py-2.5`}>
        {isPending ? "جارٍ التحقق…" : "دخول"}
      </button>
    </form>
  );
}
