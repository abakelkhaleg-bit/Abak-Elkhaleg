"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { PriceTag } from "@/components/store/price-tag";
import { useToast } from "@/components/ui/toast";
import { cart } from "@/features/cart/cart-store";
import { cn } from "@/lib/cn";
import type { VariantView } from "@/types/catalog";

const arabicNumber = new Intl.NumberFormat("ar-EG");

/**
 * اختيار الحجم والكمية والإضافة للسلة. السعر والتوفر وحد الكمية تتغير حسب الحجم المختار.
 * لا يمكن إضافة حجم نافد. الإضافة لا تخصم أي مخزون.
 */
export function PurchasePanel({
  productId,
  productName,
  variants,
}: {
  productId: string;
  productName: string;
  variants: VariantView[];
}) {
  const { notify } = useToast();
  const groupId = useId();
  const initial = variants.find((variant) => variant.inStock) ?? variants[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [quantity, setQuantity] = useState(1);

  const selected = variants.find((variant) => variant.id === selectedId);
  if (!selected) {
    return (
      <p className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
        هذا العطر غير متاح للطلب حاليًا.
      </p>
    );
  }

  const maxQuantity = selected.maxQuantity;
  const clampedQuantity = Math.min(Math.max(1, quantity), Math.max(1, maxQuantity));

  const selectVariant = (variant: VariantView) => {
    setSelectedId(variant.id);
    setQuantity((current) => Math.min(Math.max(1, current), Math.max(1, variant.maxQuantity)));
  };

  const addToCart = () => {
    if (!selected.inStock) return;
    const result = cart.add({ productId, variantId: selected.id }, clampedQuantity, maxQuantity);
    if (!result.ok) {
      notify(
        result.capped
          ? "لا يمكن إضافة كمية أكبر من المتاح لهذا الحجم."
          : "تعذر حفظ السلة على هذا المتصفح. تأكد من السماح بالتخزين المحلي.",
        "error",
      );
      return;
    }
    notify(
      result.capped
        ? `أُضيف ${productName} (${arabicNumber.format(selected.sizeMl)} مل). وصلت للحد المتاح: ${arabicNumber.format(result.quantity)}.`
        : `تمت إضافة ${productName} (${arabicNumber.format(selected.sizeMl)} مل) إلى السلة.`,
      result.capped ? "warning" : "success",
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PriceTag price={selected.price} compareAtPrice={selected.compareAtPrice} size="lg" />

      <fieldset>
        <legend id={`${groupId}-label`} className="mb-2 text-sm font-bold text-espresso">
          الحجم
        </legend>
        <div role="radiogroup" aria-labelledby={`${groupId}-label`} className="flex flex-wrap gap-2">
          {variants.map((variant) => {
            const isSelected = variant.id === selected.id;
            return (
              <button
                key={variant.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!variant.inStock}
                onClick={() => selectVariant(variant)}
                className={cn(
                  "min-w-20 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                  isSelected
                    ? "border-charcoal bg-charcoal text-ivory"
                    : "border-sand bg-white text-charcoal hover:border-gold",
                  !variant.inStock &&
                    "cursor-not-allowed border-dashed text-muted line-through decoration-1 hover:border-sand",
                  !variant.inStock && isSelected && "bg-muted text-ivory",
                )}
              >
                {arabicNumber.format(variant.sizeMl)} مل
                {!variant.inStock ? <span className="sr-only"> (نفد)</span> : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p
        className={cn("text-sm font-medium", selected.inStock ? "text-success" : "text-danger")}
        data-testid="availability"
      >
        {selected.inStock ? "متوفر" : "نفد المخزون لهذا الحجم"}
      </p>

      {selected.inStock ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-md border border-sand bg-white">
            <button
              type="button"
              onClick={() => setQuantity(clampedQuantity - 1)}
              disabled={clampedQuantity <= 1}
              className="size-11 text-lg disabled:opacity-40"
              aria-label="تقليل الكمية"
            >
              −
            </button>
            <output
              aria-live="polite"
              aria-label="الكمية"
              className="min-w-10 text-center font-bold"
              data-testid="quantity"
            >
              {arabicNumber.format(clampedQuantity)}
            </output>
            <button
              type="button"
              onClick={() => setQuantity(clampedQuantity + 1)}
              disabled={clampedQuantity >= maxQuantity}
              className="size-11 text-lg disabled:opacity-40"
              aria-label="زيادة الكمية"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="flex-1 rounded-md bg-charcoal px-6 py-3 font-bold text-ivory transition-colors hover:bg-espresso sm:flex-none"
          >
            أضف إلى السلة
          </button>
          <Link href="/cart" className="text-sm font-medium text-gold-text hover:underline">
            عرض السلة
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted">اختر حجمًا آخر متوفرًا، أو تابعنا لاحقًا.</p>
      )}
    </div>
  );
}
