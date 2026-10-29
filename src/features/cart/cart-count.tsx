"use client";

import Link from "next/link";
import { useCartCount } from "@/features/cart/cart-store";

const arabicNumber = new Intl.NumberFormat("ar-EG");

export function CartLink() {
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `السلة (${arabicNumber.format(count)} منتج)` : "السلة (فارغة)"}
      className="relative inline-flex size-11 items-center justify-center rounded-full text-espresso transition-colors hover:bg-cream"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 7h12l-1 13H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      {count > 0 ? (
        <span
          data-testid="cart-count"
          className="absolute -top-0.5 end-0 min-w-5 rounded-full bg-gold px-1 text-center text-xs font-bold leading-5 text-white"
        >
          {arabicNumber.format(count)}
        </span>
      ) : null}
    </Link>
  );
}
