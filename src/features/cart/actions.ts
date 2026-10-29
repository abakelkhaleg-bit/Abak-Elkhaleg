"use server";

import { logger } from "@/lib/logger";
import { reviewCart } from "@/server/cart.service";
import type { CartReview } from "@/types/catalog";

export type ReviewCartResult = { ok: true; data: CartReview } | { ok: false; message: string };

/**
 * يعيد التحقق من السلة على الخادم (أسعار وتوفر حاليان). للقراءة فقط — لا يغيّر المخزون.
 * المدخل غير موثوق: reviewCart يتحقق من كل بند ويتجاهل غير الصالح.
 */
export async function reviewCartAction(items: unknown): Promise<ReviewCartResult> {
  try {
    return { ok: true, data: await reviewCart(items) };
  } catch (error) {
    logger.error("فشل مراجعة السلة", { error });
    return { ok: false, message: "تعذر تحديث السلة الآن. تحقق من الاتصال وحاول مرة أخرى." };
  }
}
