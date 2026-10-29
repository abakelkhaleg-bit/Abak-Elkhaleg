import { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import { GOVERNORATE_IDS } from "@/config/governorates";
import {
  EGYPT_MOBILE_PATTERN,
  LIMITS,
  ORDER_REFERENCE_PATTERN,
  ORDER_STATUSES,
  SHA256_HEX_PATTERN,
  type OrderStatus,
} from "@/lib/validation-rules";
import { blockDeletes } from "@/models/_guards";
import { defineModel, integerValidator } from "@/models/_mongoose";

/**
 * طلب أولي يُنشأ عند فتح واتساب — لا يخصم المخزون. راجع docs/decisions/0003-order-requests.md
 * و docs/DATABASE.md §3.9. الحالة "منتهي" تُحسب عند العرض ولا تُخزن.
 */

export interface OrderItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string;
  slug: string;
  sizeMl: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderCustomer {
  name?: string;
  phone?: string;
  governorate?: string;
  address?: string;
  notes?: string;
}

export interface OrderStatusChange {
  status: OrderStatus;
  at: Date;
  note?: string;
}

export interface OrderRequest {
  reference: string;
  items: OrderItem[];
  total: number;
  customer: OrderCustomer;
  status: OrderStatus;
  statusHistory: OrderStatusChange[];
  confirmedAt?: Date;
  cancelledAt?: Date;
  piiPurgedAt?: Date;
  ipHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderRequestDocument = HydratedDocument<OrderRequest>;
export type OrderRequestModel = Model<OrderRequest>;

const orderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    sizeMl: { type: Number, required: true, validate: integerValidator },
    unitPrice: { type: Number, required: true, min: 1, validate: integerValidator },
    quantity: {
      type: Number,
      required: true,
      min: [1, "الكمية يجب أن تكون 1 على الأقل."],
      max: [LIMITS.orderItemQuantity.max, "الكمية أكبر من الحد المسموح للطلب."],
      validate: integerValidator,
    },
    lineTotal: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderRequest, OrderRequestModel>(
  {
    reference: {
      type: String,
      required: true,
      immutable: true,
      match: [ORDER_REFERENCE_PATTERN, "صيغة الرقم المرجعي غير صحيحة."],
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items: OrderItem[]) =>
          items.length >= 1 && items.length <= LIMITS.orderItems.max,
        message: `الطلب يجب أن يحتوي من 1 إلى ${LIMITS.orderItems.max} بندًا.`,
      },
    },
    total: { type: Number, required: true, min: 1, validate: integerValidator },
    customer: {
      name: {
        type: String,
        trim: true,
        minlength: LIMITS.customerName.min,
        maxlength: LIMITS.customerName.max,
      },
      phone: { type: String, trim: true, match: [EGYPT_MOBILE_PATTERN, "رقم الموبايل غير صالح."] },
      governorate: { type: String, enum: GOVERNORATE_IDS },
      address: { type: String, trim: true, maxlength: LIMITS.customerAddress.max },
      notes: { type: String, trim: true, maxlength: LIMITS.customerNotes.max },
    },
    status: { type: String, enum: ORDER_STATUSES, default: "opened_in_whatsapp" },
    statusHistory: {
      type: [
        {
          _id: false,
          status: { type: String, enum: ORDER_STATUSES, required: true },
          at: { type: Date, required: true },
          note: { type: String, trim: true, maxlength: 300 },
        },
      ],
      default: () => [{ status: "opened_in_whatsapp", at: new Date() }],
    },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
    piiPurgedAt: { type: Date },
    ipHash: { type: String, match: SHA256_HEX_PATTERN },
  },
  { timestamps: true },
);

orderSchema.pre("validate", function () {
  for (const [index, item] of this.items.entries()) {
    if (item.lineTotal !== item.unitPrice * item.quantity) {
      this.invalidate(`items.${index}.lineTotal`, "إجمالي البند لا يساوي السعر × الكمية.");
    }
  }
  const sum = this.items.reduce((total, item) => total + item.lineTotal, 0);
  if (this.total !== sum) this.invalidate("total", "إجمالي الطلب لا يساوي مجموع البنود.");

  if (!this.piiPurgedAt) {
    if (!this.customer?.name) this.invalidate("customer.name", "الاسم مطلوب.");
    if (!this.customer?.phone) this.invalidate("customer.phone", "رقم الموبايل مطلوب.");
    if (!this.customer?.governorate) this.invalidate("customer.governorate", "المحافظة مطلوبة.");
  }
});

orderSchema.index({ reference: 1 }, { unique: true });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

blockDeletes(orderSchema, "لا يمكن حذف الطلبات؛ يمكن حذف البيانات الشخصية للعميل فقط.");

export const OrderRequestModel = defineModel<OrderRequest, OrderRequestModel>(
  "OrderRequest",
  orderSchema,
);
