import { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import {
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/validation-rules";
import { defineModel, integerValidator } from "@/models/_mongoose";

/**
 * تنبيهات المخزون داخل لوحة الإدارة. راجع docs/DATABASE.md §3.5.
 * isOpen = true طوال دورة التنبيه؛ عند تجدد المخزون تُغلق (isOpen=false, resolvedAt=now)
 * فيسمح الفهرس الفريد الجزئي بفتح دورة جديدة لاحقًا.
 */

export interface Notification {
  type: NotificationType;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string;
  sizeMl: number;
  quantityAtTrigger: number;
  message: string;
  status: (typeof NOTIFICATION_STATUSES)[number];
  isOpen: boolean;
  resolvedAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export type NotificationModel = Model<Notification>;

const notificationSchema = new Schema<Notification, NotificationModel>(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    sizeMl: { type: Number, required: true, validate: integerValidator },
    quantityAtTrigger: { type: Number, required: true, min: 0, validate: integerValidator },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "unread" },
    isOpen: { type: Boolean, default: true },
    resolvedAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true },
);

notificationSchema.pre("validate", function () {
  if (this.isOpen && this.resolvedAt) {
    this.invalidate("resolvedAt", "التنبيه المفتوح لا يمكن أن يكون له تاريخ إغلاق.");
  }
});

// تنبيه مفتوح واحد فقط لكل حجم ونوع — يمنع التكرار عند كل تحميل أو عملية.
notificationSchema.index(
  { variantId: 1, type: 1 },
  { unique: true, partialFilterExpression: { isOpen: true } },
);
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ isOpen: 1, createdAt: -1 });

export const NotificationModel = defineModel<Notification, NotificationModel>(
  "Notification",
  notificationSchema,
);
