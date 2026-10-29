"use client";

import { useSyncExternalStore } from "react";
import { LIMITS } from "@/lib/validation-rules";

/**
 * السلة في localStorage: معرّفات وكميات فقط — لا أسعار ولا أسماء.
 * ليست مصدرًا موثوقًا؛ الخادم يعيد القراءة والحساب عبر reviewCart.
 * إضافة منتج للسلة لا تمس المخزون إطلاقًا.
 */

export type CartItem = { productId: string; variantId: string; quantity: number };

const STORAGE_KEY = "abak-cart-v1";
const CHANGE_EVENT = "abak-cart-change";
const EMPTY: CartItem[] = [];
const OBJECT_ID = /^[a-f0-9]{24}$/i;

let cachedRaw: string | null | undefined;
let cachedItems: CartItem[] = EMPTY;

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    OBJECT_ID.test(item.productId) &&
    typeof item.variantId === "string" &&
    OBJECT_ID.test(item.variantId) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
}

function parse(raw: string | null): CartItem[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isCartItem).slice(0, LIMITS.orderItems.max) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function readItems(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parse(raw);
  }
  return cachedItems;
}

function writeItems(items: CartItem[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  } finally {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribe, readItems, () => EMPTY);
}

export function useCartCount(): number {
  return useCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

const sameLine = (a: Pick<CartItem, "productId" | "variantId">, b: CartItem) =>
  a.productId === b.productId && a.variantId === b.variantId;

export type AddResult = { ok: boolean; quantity: number; capped: boolean };

export const cart = {
  /** يضيف كمية لحجم معين مع حد أقصى (من الخادم). يعيد الكمية النهائية في السلة. */
  add(
    line: Pick<CartItem, "productId" | "variantId">,
    quantity: number,
    maxQuantity: number,
  ): AddResult {
    const items = readItems();
    const existing = items.find((item) => sameLine(line, item));
    const limit = Math.max(0, Math.min(maxQuantity, LIMITS.orderItemQuantity.max));
    const desired = (existing?.quantity ?? 0) + quantity;
    const finalQuantity = Math.min(desired, limit);
    if (finalQuantity <= 0 || (existing && existing.quantity >= limit)) {
      return { ok: false, quantity: existing?.quantity ?? 0, capped: true };
    }
    if (!existing && items.length >= LIMITS.orderItems.max) {
      return { ok: false, quantity: 0, capped: true };
    }
    const next = existing
      ? items.map((item) => (sameLine(line, item) ? { ...item, quantity: finalQuantity } : item))
      : [...items, { ...line, quantity: finalQuantity }];
    const saved = writeItems(next);
    return { ok: saved, quantity: finalQuantity, capped: finalQuantity < desired };
  },
  setQuantity(line: Pick<CartItem, "productId" | "variantId">, quantity: number): void {
    const items = readItems();
    writeItems(
      quantity <= 0
        ? items.filter((item) => !sameLine(line, item))
        : items.map((item) => (sameLine(line, item) ? { ...item, quantity } : item)),
    );
  },
  remove(line: Pick<CartItem, "productId" | "variantId">): void {
    writeItems(readItems().filter((item) => !sameLine(line, item)));
  },
  /** يستبدل السلة بما أكده الخادم (بعد حذف غير المتاح وتعديل الكميات). */
  replace(items: CartItem[]): void {
    writeItems(items);
  },
};
