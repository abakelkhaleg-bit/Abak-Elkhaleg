import "server-only";
import type { ClientSession, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { NotificationType } from "@/lib/validation-rules";
import { NotificationModel } from "@/models/notification";
import { trusted } from "@/models/_mongoose";

/**
 * تنبيهات المخزون (docs/DATABASE.md §3.5). تُزامن فقط عند تغيّر المخزون أو حد التنبيه —
 * لا تُنشأ عند فتح لوحة التحكم. تنبيه مفتوح واحد لكل حجم ونوع (فهرس فريد جزئي على isOpen)؛
 * ارتفاع المخزون فوق الحد يغلق الدورة، فإن انخفض لاحقًا تبدأ دورة جديدة.
 */

export type VariantStockState = {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string;
  sizeMl: number;
  quantity: number;
  threshold: number;
  isAvailable: boolean;
};

const arabicNumber = new Intl.NumberFormat("ar-EG");

function messageFor(type: NotificationType, state: VariantStockState): string {
  const label = `${state.productName} — ${arabicNumber.format(state.sizeMl)} مل`;
  return type === "out_of_stock"
    ? `${label}: نفد المخزون`
    : `${label}: المتبقي ${arabicNumber.format(state.quantity)}`;
}

async function ensureOpen(type: NotificationType, state: VariantStockState, session?: ClientSession) {
  await NotificationModel.findOneAndUpdate(
    { variantId: state.variantId, type, isOpen: true },
    {
      $setOnInsert: {
        type,
        productId: state.productId,
        variantId: state.variantId,
        productName: state.productName,
        sizeMl: state.sizeMl,
        quantityAtTrigger: state.quantity,
        message: messageFor(type, state),
        status: "unread",
        isOpen: true,
      },
    },
    { upsert: true, session, setDefaultsOnInsert: true },
  );
}

async function close(
  variantId: Types.ObjectId,
  types: NotificationType[],
  session?: ClientSession,
) {
  await NotificationModel.updateMany(
    { variantId, type: trusted({ $in: types }), isOpen: true },
    { isOpen: false, resolvedAt: new Date() },
    { session },
  );
}

export async function syncVariantNotifications(
  state: VariantStockState,
  session?: ClientSession,
): Promise<void> {
  if (!state.isAvailable || state.quantity > state.threshold) {
    // حجم غير معروض للبيع أو مخزون كافٍ: تُغلق الدورة الحالية.
    await close(state.variantId, ["low_stock", "out_of_stock"], session);
    return;
  }
  if (state.quantity === 0) {
    await ensureOpen("out_of_stock", state, session);
    return;
  }
  await close(state.variantId, ["out_of_stock"], session);
  await ensureOpen("low_stock", state, session);
}

export async function syncProductNotifications(
  product: {
    _id: Types.ObjectId;
    name: string;
    variants: Array<{
      _id: Types.ObjectId;
      sizeMl: number;
      stockQuantity: number;
      lowStockThreshold: number;
      isAvailable: boolean;
    }>;
  },
  session?: ClientSession,
): Promise<void> {
  for (const variant of product.variants) {
    await syncVariantNotifications(
      {
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        sizeMl: variant.sizeMl,
        quantity: variant.stockQuantity,
        threshold: variant.lowStockThreshold,
        isAvailable: variant.isAvailable,
      },
      session,
    );
  }
}

// ─── عرض التنبيهات في الإدارة ───────────────────────────────────────────

export type NotificationRow = {
  id: string;
  type: NotificationType;
  productId: string;
  message: string;
  status: "unread" | "read";
  isOpen: boolean;
  createdAt: string;
  resolvedAt: string | null;
};

export const NOTIFICATIONS_PAGE_SIZE = 30;

export async function listNotifications(options: { onlyOpen: boolean; page: number }) {
  await connectToDatabase();
  const filter = options.onlyOpen ? { isOpen: true } : {};
  const total = await NotificationModel.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page), pageCount);
  const docs = await NotificationModel.find(filter)
    .sort({ isOpen: -1, status: -1, createdAt: -1 })
    .skip((page - 1) * NOTIFICATIONS_PAGE_SIZE)
    .limit(NOTIFICATIONS_PAGE_SIZE)
    .lean();
  const items: NotificationRow[] = docs.map((doc) => ({
    id: doc._id.toString(),
    type: doc.type,
    productId: doc.productId.toString(),
    message: doc.message,
    status: doc.status,
    isOpen: doc.isOpen,
    createdAt: doc.createdAt.toISOString(),
    resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
  }));
  return { items, total, page, pageCount };
}

export async function countUnreadNotifications(): Promise<number> {
  await connectToDatabase();
  return NotificationModel.countDocuments({ status: "unread", isOpen: true });
}

export async function markNotificationRead(id: unknown): Promise<void> {
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) {
    throw new AppError("NOT_FOUND", "التنبيه غير موجود.");
  }
  await connectToDatabase();
  const result = await NotificationModel.updateOne(
    { _id: id },
    { status: "read", readAt: new Date() },
  );
  if (result.matchedCount === 0) throw new AppError("NOT_FOUND", "التنبيه غير موجود.");
}

export async function markAllNotificationsRead(): Promise<number> {
  await connectToDatabase();
  const result = await NotificationModel.updateMany(
    { status: "unread" },
    { status: "read", readAt: new Date() },
  );
  return result.modifiedCount;
}
