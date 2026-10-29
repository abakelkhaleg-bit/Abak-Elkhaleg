"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useTransition } from "react";
import { buttonClass } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/action-result";

/**
 * زر ينفذ Server Action (مربوطة مسبقًا بمعاملاتها)، مع تعطيل أثناء التنفيذ ورسالة نجاح/فشل.
 * مع confirmText يُطلب تأكيد عبر <dialog> قبل التنفيذ (مثل الحذف).
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  successMessage,
  confirmText,
  variant = "secondary",
  redirectTo,
  className,
}: {
  action: () => Promise<ActionResult<unknown>>;
  label: string;
  pendingLabel?: string;
  successMessage: string;
  confirmText?: string;
  variant?: keyof typeof buttonClass;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const run = () => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        notify(result.error.message, "error");
        if (result.error.code === "UNAUTHORIZED") router.push("/admin/login");
        return;
      }
      notify(successMessage, "success");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => (confirmText ? dialogRef.current?.showModal() : run())}
        className={className ?? buttonClass[variant]}
      >
        {isPending ? (pendingLabel ?? "جارٍ التنفيذ…") : label}
      </button>
      {confirmText ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="m-auto w-[min(90vw,26rem)] rounded-lg bg-white p-6 shadow-lifted backdrop:bg-charcoal/50"
        >
          <h2 id={titleId} className="text-lg">
            تأكيد العملية
          </h2>
          <p className="mt-2 text-sm leading-7 text-charcoal">{confirmText}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className={buttonClass.secondary}
              onClick={() => dialogRef.current?.close()}
            >
              إلغاء
            </button>
            <button
              type="button"
              className={buttonClass[variant === "danger" ? "danger" : "primary"]}
              onClick={() => {
                dialogRef.current?.close();
                run();
              }}
            >
              تأكيد
            </button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
