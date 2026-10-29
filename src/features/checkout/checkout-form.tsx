"use client";

import { useId, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { EGYPT_GOVERNORATES } from "@/config/governorates";
import { createOrderAction } from "@/features/checkout/actions";
import { cart } from "@/features/cart/cart-store";
import type { FieldErrors } from "@/lib/errors";
import { formatEGP } from "@/lib/money";
import type { CartLine } from "@/types/catalog";

const inputClass =
  "w-full rounded-md border border-sand bg-white px-3 py-2.5 text-sm text-charcoal focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 aria-[invalid=true]:border-danger";

/** نص ثابت للعميل (ADR 0003): الطلب لا يُرسل إلا بضغطه «إرسال» في واتساب، ولا يُعتبر مؤكدًا بعد. */
export const ORDER_DISCLAIMER =
  "سيفتح واتساب برسالة جاهزة فيها تفاصيل طلبك. الطلب لا يصل للمتجر إلا بعد أن تضغط «إرسال» في واتساب، ولا يُعتبر مؤكدًا حتى يتواصل معك المتجر لتأكيد التوفر والتوصيل.";

/**
 * نموذج الطلب عبر واتساب. يرسل المعرّفات والكميات وبيانات العميل فقط؛
 * الأسعار والإجمالي ورابط واتساب كلها من الخادم.
 */
export function CheckoutForm({
  lines,
  whatsappAvailable,
}: {
  lines: CartLine[];
  whatsappAvailable: boolean;
}) {
  const { notify } = useToast();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<{ reference: string; whatsappUrl: string; total: number } | null>(
    null,
  );
  const [form, setForm] = useState({ name: "", phone: "", governorate: "", address: "", notes: "" });

  if (!whatsappAvailable) {
    return (
      <div className="flex flex-col gap-2" data-testid="checkout-unavailable">
        <button
          type="button"
          disabled
          className="w-full rounded-md bg-sand px-4 py-3 text-sm font-bold text-muted"
          aria-describedby={`${id}-unavailable`}
        >
          اطلب عبر واتساب
        </button>
        <p id={`${id}-unavailable`} className="text-xs leading-6 text-warning">
          الطلب عبر واتساب غير متاح حاليًا لأن رقم المتجر لم يُضبط بعد. تواصل مع المتجر بالطرق
          الأخرى في أسفل الصفحة.
        </p>
      </div>
    );
  }

  if (created) {
    return (
      <div className="flex flex-col gap-3" data-testid="checkout-created" aria-live="polite">
        <p className="text-sm">
          رقم طلبك المرجعي:{" "}
          <bdi className="font-extrabold text-charcoal" data-testid="order-reference">
            {created.reference}
          </bdi>
        </p>
        <p className="text-sm">الإجمالي: {formatEGP(created.total)} (غير شامل التوصيل)</p>
        <a
          href={created.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-md bg-[#1a7f4b] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#156a3e]"
          data-testid="open-whatsapp"
        >
          افتح واتساب لإرسال الطلب
        </a>
        <p className="text-xs leading-6 text-muted">{ORDER_DISCLAIMER}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <button type="button" className="text-gold-text underline" onClick={() => setCreated(null)}>
            تعديل البيانات
          </button>
          <button
            type="button"
            className="text-muted underline"
            onClick={() => {
              cart.replace([]);
              notify("أُفرغت السلة.", "info");
            }}
          >
            إفراغ السلة
          </button>
        </div>
      </div>
    );
  }

  const err = (key: string) => errors[`customer.${key}`];
  const field = (key: keyof typeof form) => ({
    id: `${id}-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: e.target.value })),
    "aria-invalid": Boolean(err(key)),
    "aria-describedby": err(key) ? `${id}-${key}-error` : undefined,
    className: inputClass,
  });
  const errorText = (key: string) =>
    err(key) ? (
      <p id={`${id}-${key}-error`} className="mt-1 text-xs text-danger">
        {err(key)?.join(" ")}
      </p>
    ) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
      customer: form,
    };
    startTransition(async () => {
      const result = await createOrderAction(payload);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        notify(result.error.message, "error");
        return;
      }
      setErrors({});
      setCreated(result.data);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-busy={isPending}>
      <h3 className="text-base font-bold">بيانات الطلب</h3>
      <div>
        <label htmlFor={`${id}-name`} className="mb-1 block text-sm">
          الاسم <span aria-hidden="true">*</span>
        </label>
        <input {...field("name")} autoComplete="name" maxLength={60} required />
        {errorText("name")}
      </div>
      <div>
        <label htmlFor={`${id}-phone`} className="mb-1 block text-sm">
          رقم الموبايل <span aria-hidden="true">*</span>
        </label>
        <input
          {...field("phone")}
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="01012345678"
          required
        />
        {errorText("phone")}
      </div>
      <div>
        <label htmlFor={`${id}-governorate`} className="mb-1 block text-sm">
          المحافظة <span aria-hidden="true">*</span>
        </label>
        <select {...field("governorate")} required>
          <option value="">اختر المحافظة</option>
          {EGYPT_GOVERNORATES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {errorText("governorate")}
      </div>
      <div>
        <label htmlFor={`${id}-address`} className="mb-1 block text-sm">
          العنوان (اختياري)
        </label>
        <textarea {...field("address")} rows={2} maxLength={300} autoComplete="street-address" />
        {errorText("address")}
      </div>
      <div>
        <label htmlFor={`${id}-notes`} className="mb-1 block text-sm">
          ملاحظات (اختياري)
        </label>
        <textarea {...field("notes")} rows={2} maxLength={500} />
        {errorText("notes")}
      </div>
      <p className="text-xs leading-6 text-muted">{ORDER_DISCLAIMER}</p>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-[#1a7f4b] px-4 py-3 text-sm font-bold text-white hover:bg-[#156a3e] disabled:opacity-60"
      >
        {isPending ? "جارٍ تجهيز الطلب…" : "اطلب عبر واتساب"}
      </button>
    </form>
  );
}
