"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { EmptyState } from "@/components/store/empty-state";
import { useToast } from "@/components/ui/toast";
import { siteConfig } from "@/config/site";
import { reviewCartAction } from "@/features/cart/actions";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { cart, useCartItems, type CartItem } from "@/features/cart/cart-store";
import { formatEGP } from "@/lib/money";
import type { CartLine, CartRemoval, CartReview } from "@/types/catalog";

const arabicNumber = new Intl.NumberFormat("ar-EG");
const subscribeNoop = () => () => {};

const REMOVAL_REASONS = {
  unavailable: "لم يعد متاحًا",
  out_of_stock: "نفد المخزون",
  invalid: "بيانات غير صالحة",
} as const;

/**
 * صفحة السلة: كل ما يُعرض من أسعار وإجماليات يأتي من الخادم (reviewCartAction).
 * إن تغيرت الأسعار أو نفد حجم أو قلّ المتاح، تُصحَّح السلة المحلية ويُبلَّغ العميل.
 */
export function CartView({ whatsappAvailable }: { whatsappAvailable: boolean }) {
  const items = useCartItems();
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const { notify } = useToast();
  const [review, setReview] = useState<CartReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [attempt, setAttempt] = useState(0);
  // ما أزاله الخادم يبقى ظاهرًا حتى بعد تصحيح السلة المحلية (المراجعة التالية لن تذكره).
  const [removedHistory, setRemovedHistory] = useState<CartRemoval[]>([]);
  const lastNotice = useRef("");

  const itemsKey = JSON.stringify(items);

  useEffect(() => {
    if (!isClient) return;
    const current = JSON.parse(itemsKey) as CartItem[];
    if (current.length === 0) return;
    startTransition(async () => {
      const result = await reviewCartAction(current);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setReview(result.data);
      if (result.data.removed.length > 0) {
        setRemovedHistory((previous) => {
          const keyOf = (item: CartRemoval) => `${item.productId}:${item.variantId}`;
          const known = new Set(previous.map(keyOf));
          return [...previous, ...result.data.removed.filter((item) => !known.has(keyOf(item)))];
        });
      }

      const confirmed: CartItem[] = result.data.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      }));
      if (JSON.stringify(confirmed) === JSON.stringify(current)) return;

      const notes: string[] = [];
      if (result.data.removed.length > 0) {
        notes.push(
          `أُزيل ${arabicNumber.format(result.data.removed.length)} منتج من السلة لأنه لم يعد متاحًا.`,
        );
      }
      if (result.data.lines.some((line) => line.status === "adjusted")) {
        notes.push("عُدّلت بعض الكميات لتناسب المتاح.");
      }
      const notice = notes.join(" ");
      if (notice && notice !== lastNotice.current) {
        lastNotice.current = notice;
        notify(notice, "warning");
      }
      cart.replace(confirmed);
    });
  }, [itemsKey, isClient, attempt, notify]);

  if (!isClient) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {removedHistory.length > 0 ? <RemovedNotice removed={removedHistory} /> : null}
        <EmptyState
          title="سلتك فارغة"
          description="أضف العطور التي تعجبك لتظهر هنا."
          action={{ href: "/perfumes", label: "تصفح العطور" }}
        />
      </div>
    );
  }

  if (error && !review) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-lg bg-danger-soft px-6 py-10 text-center"
      >
        <p className="font-medium text-danger">{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          disabled={isPending}
          className="rounded-md bg-charcoal px-6 py-2.5 text-sm font-medium text-ivory disabled:opacity-60"
        >
          {isPending ? "جارٍ المحاولة…" : "إعادة المحاولة"}
        </button>
      </div>
    );
  }

  if (!review) return <CartSkeleton />;

  const changeQuantity = (line: CartLine, quantity: number) => {
    const next = Math.min(Math.max(1, quantity), line.maxQuantity);
    if (next === line.quantity) return;
    cart.setQuantity(line, next);
    notify("تم تحديث الكمية.", "info");
  };

  const removeLine = (line: CartLine) => {
    cart.remove(line);
    notify(`أُزيل ${line.name} من السلة.`, "info");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]" aria-busy={isPending}>
      <section aria-label="منتجات السلة" className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <ul className="flex flex-col divide-y divide-sand rounded-lg bg-white shadow-soft ring-1 ring-sand/60">
          {review.lines.map((line) => (
            <li
              key={`${line.productId}-${line.variantId}`}
              className="flex gap-4 p-4"
              data-testid="cart-line"
            >
              <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-cream">
                <Image
                  src={line.image?.src ?? siteConfig.brandAssets.placeholder}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/perfumes/${line.slug}`}
                      className="font-bold text-charcoal hover:underline"
                    >
                      {line.name}
                    </Link>
                    <p className="text-sm text-muted">
                      الحجم: {arabicNumber.format(line.sizeMl)} مل
                    </p>
                  </div>
                  <p className="font-bold text-espresso" data-testid="line-total">
                    {formatEGP(line.lineTotal)}
                  </p>
                </div>
                <p className="text-sm text-muted">
                  سعر القطعة: {formatEGP(line.unitPrice)}
                  {line.compareAtPrice ? (
                    <s className="ms-2">{formatEGP(line.compareAtPrice)}</s>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-md border border-sand">
                    <button
                      type="button"
                      onClick={() => changeQuantity(line, line.quantity - 1)}
                      disabled={isPending || line.quantity <= 1}
                      className="size-9 disabled:opacity-40"
                      aria-label={`تقليل كمية ${line.name}`}
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-bold" data-testid="line-quantity">
                      {arabicNumber.format(line.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(line, line.quantity + 1)}
                      disabled={isPending || line.quantity >= line.maxQuantity}
                      className="size-9 disabled:opacity-40"
                      aria-label={`زيادة كمية ${line.name}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line)}
                    disabled={isPending}
                    className="text-sm text-danger hover:underline disabled:opacity-50"
                  >
                    حذف
                  </button>
                  {line.quantity >= line.maxQuantity ? (
                    <span className="text-xs text-warning">
                      أقصى كمية متاحة: {arabicNumber.format(line.maxQuantity)}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {removedHistory.length > 0 ? <RemovedNotice removed={removedHistory} /> : null}

        <Link href="/perfumes" className="w-fit text-sm font-medium text-gold-text hover:underline">
          متابعة التسوق
        </Link>
      </section>

      <aside
        aria-label="ملخص السلة"
        className="flex h-fit flex-col gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60 lg:sticky lg:top-28"
      >
        <h2 className="text-lg">ملخص الطلب</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">عدد القطع</dt>
            <dd>{arabicNumber.format(review.itemCount)}</dd>
          </div>
          <div className="flex justify-between border-t border-sand pt-3 text-base font-bold">
            <dt>الإجمالي</dt>
            <dd data-testid="cart-total">{formatEGP(review.total)}</dd>
          </div>
        </dl>
        <p className="text-xs leading-6 text-muted">
          الأسعار محسوبة من المتجر مباشرة. رسوم التوصيل يُتفق عليها عند تأكيد الطلب.
        </p>
        <div className="border-t border-sand pt-4">
          <CheckoutForm lines={review.lines} whatsappAvailable={whatsappAvailable} />
        </div>
      </aside>
    </div>
  );
}

function RemovedNotice({ removed }: { removed: CartRemoval[] }) {
  return (
    <div className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
      <p className="font-bold">أُزيلت منتجات من السلة:</p>
      <ul className="mt-1 list-inside list-disc">
        {removed.map((item, index) => (
          <li key={`${item.productId}-${item.variantId}-${index}`}>
            {item.name ?? "منتج"} — {REMOVAL_REASONS[item.reason]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">جارٍ تحميل السلة…</span>
      {[0, 1].map((index) => (
        <div key={index} className="h-28 animate-pulse rounded-lg bg-cream" />
      ))}
    </div>
  );
}
