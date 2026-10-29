"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { createOrderRequest, type CreatedOrder } from "@/server/orders.service";
import { getRequestContext } from "@/server/request-context";

/**
 * إنشاء طلب أولي وفتح واتساب (عام، بلا جلسة). المدخل غير موثوق بالكامل:
 * الخدمة تعيد حساب الأسعار من القاعدة، ولا تخصم المخزون، ومحمية بـ rate limit لكل IP.
 */
export async function createOrderAction(input: unknown): Promise<ActionResult<CreatedOrder>> {
  try {
    const { ip } = await getRequestContext();
    return actionOk(await createOrderRequest(input, { ip }));
  } catch (error) {
    return actionError(error);
  }
}
