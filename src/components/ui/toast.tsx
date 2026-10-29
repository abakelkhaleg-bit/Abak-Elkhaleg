"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * إشعارات قصيرة (نجاح/تحذير/خطأ) تُقرأ لقارئات الشاشة عبر aria-live.
 * تُستخدم عند الإضافة للسلة وتعديل الكمية وفشل العمليات.
 */

type ToastTone = "success" | "warning" | "error" | "info";
type Toast = { id: number; tone: ToastTone; message: string };
type ToastApi = { notify: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi | null>(null);

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  error: "border-danger/30 bg-danger-soft text-danger",
  info: "border-sand bg-ivory text-charcoal",
};

const DISMISS_AFTER_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm font-medium shadow-lifted",
              TONE_CLASSES[toast.tone],
            )}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded px-1 opacity-70 hover:opacity-100"
              aria-label="إغلاق الإشعار"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast يجب أن يُستخدم داخل ToastProvider.");
  return context;
}
