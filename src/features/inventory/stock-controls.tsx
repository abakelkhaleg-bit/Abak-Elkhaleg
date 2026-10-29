"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { buttonClass, inputClass } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import { applyStockOperationAction, setLowStockThresholdAction } from "@/features/inventory/actions";
import type { ActionResult } from "@/lib/action-result";
import type { FieldErrors } from "@/lib/errors";

type Operation = "restock" | "adjustment" | "stocktake";

const OPERATIONS: Record<Operation, { label: string; amount: string; hint: string }> = {
  restock: { label: "إضافة كمية (توريد)", amount: "الكمية المضافة", hint: "السبب اختياري." },
  adjustment: {
    label: "تعديل بالزيادة أو النقص",
    amount: "التغيير (مثل ‎-2 أو 3)",
    hint: "السبب إلزامي: تالف، هدية، خطأ إدخال…",
  },
  stocktake: {
    label: "تصحيح جرد",
    amount: "الكمية الفعلية المعدودة",
    hint: "السبب إلزامي. تُحسب الكمية الجديدة كما عددتها.",
  },
};

const toInt = (value: string) => (/^-?\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

/** أدوات تعديل مخزون حجم واحد في صفحة المخزون. كل عملية تُسجَّل حركةً على الخادم. */
export function StockControls({
  productId,
  variantId,
  label,
  stockQuantity,
  lowStockThreshold,
}: {
  productId: string;
  variantId: string;
  label: string;
  stockQuantity: number;
  lowStockThreshold: number;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [operation, setOperation] = useState<Operation>("restock");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [threshold, setThreshold] = useState(String(lowStockThreshold));
  const [errors, setErrors] = useState<FieldErrors>({});

  const handle = <T,>(result: ActionResult<T>, success: string) => {
    if (!result.ok) {
      setErrors(result.error.fieldErrors ?? {});
      notify(result.error.message, "error");
      if (result.error.code === "UNAUTHORIZED") router.push("/admin/login");
      return false;
    }
    setErrors({});
    notify(success, "success");
    router.refresh();
    return true;
  };

  const submitOperation = (event: React.FormEvent) => {
    event.preventDefault();
    const value = toInt(amount);
    const base = { type: operation, productId, variantId, ...(reason.trim() ? { reason } : {}) };
    const payload =
      operation === "restock"
        ? { ...base, quantity: value }
        : operation === "adjustment"
          ? { ...base, delta: value }
          : { ...base, newQuantity: value };
    startTransition(async () => {
      const result = await applyStockOperationAction(payload);
      const ok = handle(
        result,
        result.ok
          ? `${label}: المخزون ${result.data.previousQuantity} ← ${result.data.newQuantity}.`
          : "",
      );
      if (ok) {
        setAmount("");
        setReason("");
      }
    });
  };

  const submitThreshold = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await setLowStockThresholdAction({
        productId,
        variantId,
        lowStockThreshold: toInt(threshold),
      });
      handle(result, `${label}: حُفظ حد التنبيه.`);
    });
  };

  const fieldError = (...keys: string[]) => keys.flatMap((key) => errors[key] ?? []);
  const amountErrors = fieldError("quantity", "delta", "newQuantity");
  const reasonErrors = fieldError("reason");
  const thresholdErrors = fieldError("lowStockThreshold");

  return (
    <details className="group rounded-md border border-sand" data-testid="stock-controls">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-espresso">
        تعديل المخزون
      </summary>
      <div className="flex flex-col gap-4 border-t border-sand p-3" aria-busy={isPending}>
        <form onSubmit={submitOperation} noValidate className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-op`} className="mb-1 block text-xs text-muted">
              نوع العملية
            </label>
            <select
              id={`${id}-op`}
              value={operation}
              onChange={(e) => {
                setOperation(e.target.value as Operation);
                setErrors({});
              }}
              className={inputClass}
            >
              {(Object.keys(OPERATIONS) as Operation[]).map((key) => (
                <option key={key} value={key}>
                  {OPERATIONS[key].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-amount`} className="mb-1 block text-xs text-muted">
              {OPERATIONS[operation].amount}
            </label>
            <input
              id={`${id}-amount`}
              inputMode="numeric"
              value={amount}
              placeholder={operation === "stocktake" ? String(stockQuantity) : ""}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              aria-invalid={amountErrors.length > 0}
              aria-describedby={amountErrors.length > 0 ? `${id}-amount-error` : undefined}
            />
            {amountErrors.length > 0 ? (
              <p id={`${id}-amount-error`} className="mt-1 text-xs text-danger">
                {amountErrors.join(" ")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${id}-reason`} className="mb-1 block text-xs text-muted">
              السبب{operation === "restock" ? " (اختياري)" : ""}
            </label>
            <input
              id={`${id}-reason`}
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
              aria-invalid={reasonErrors.length > 0}
              aria-describedby={`${id}-reason-hint`}
            />
            <p id={`${id}-reason-hint`} className={`mt-1 text-xs ${reasonErrors.length > 0 ? "text-danger" : "text-muted"}`}>
              {reasonErrors.length > 0 ? reasonErrors.join(" ") : OPERATIONS[operation].hint}
            </p>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={isPending} className={buttonClass.primary}>
              {isPending ? "جارٍ الحفظ…" : "تنفيذ"}
            </button>
          </div>
        </form>

        <form onSubmit={submitThreshold} noValidate className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`${id}-threshold`} className="mb-1 block text-xs text-muted">
              حد تنبيه المخزون المنخفض
            </label>
            <input
              id={`${id}-threshold`}
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className={`${inputClass} w-28`}
              aria-invalid={thresholdErrors.length > 0}
            />
          </div>
          <button type="submit" disabled={isPending} className={buttonClass.secondary}>
            حفظ الحد
          </button>
          {thresholdErrors.length > 0 ? (
            <p className="w-full text-xs text-danger">{thresholdErrors.join(" ")}</p>
          ) : null}
        </form>
      </div>
    </details>
  );
}
