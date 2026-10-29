import { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import {
  LIMITS,
  MOVEMENT_TYPES,
  MOVEMENT_TYPES_REQUIRING_REASON,
  ORDER_MOVEMENT_TYPES,
  type MovementType,
} from "@/lib/validation-rules";
import { makeAppendOnly } from "@/models/_guards";
import { defineModel, integerValidator } from "@/models/_mongoose";

/** سجل حركات المخزون — للإضافة فقط. راجع docs/DATABASE.md §3.4. */

export interface InventoryMovement {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  /** snapshot حتى يبقى السجل مقروءًا بعد حذف المنتج. */
  productName: string;
  sizeMl: number;
  movementType: MovementType;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  orderId?: Types.ObjectId;
  createdAt: Date;
}

export type InventoryMovementDocument = HydratedDocument<InventoryMovement>;
export type InventoryMovementModel = Model<InventoryMovement>;

const quantity = {
  type: Number,
  required: true,
  min: [0, "الكمية لا يمكن أن تكون سالبة."] as [number, string],
  validate: integerValidator,
};

const movementSchema = new Schema<InventoryMovement, InventoryMovementModel>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    sizeMl: { type: Number, required: true, validate: integerValidator },
    movementType: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantityDelta: { type: Number, required: true, validate: integerValidator },
    previousQuantity: quantity,
    newQuantity: quantity,
    reason: {
      type: String,
      trim: true,
      minlength: [LIMITS.movementReason.min, "سبب التعديل قصير جدًا."],
      maxlength: [LIMITS.movementReason.max, "سبب التعديل طويل جدًا."],
    },
    orderId: { type: Schema.Types.ObjectId, ref: "OrderRequest" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

movementSchema.pre("validate", function () {
  if (this.newQuantity !== this.previousQuantity + this.quantityDelta) {
    this.invalidate("newQuantity", "الكمية الجديدة لا تساوي الكمية السابقة + التغيير.");
  }
  if (this.quantityDelta === 0 && this.movementType !== "stocktake") {
    this.invalidate("quantityDelta", "الحركة يجب أن تغيّر الكمية.");
  }
  if (MOVEMENT_TYPES_REQUIRING_REASON.includes(this.movementType) && !this.reason) {
    this.invalidate("reason", "سبب التعديل مطلوب لهذا النوع من الحركات.");
  }
  if (ORDER_MOVEMENT_TYPES.includes(this.movementType) && !this.orderId) {
    this.invalidate("orderId", "حركات البيع والإرجاع يجب أن ترتبط بطلب.");
  }
});

movementSchema.index({ productId: 1, createdAt: -1 });
movementSchema.index({ createdAt: -1 });
// يمنع خصم نفس بند الطلب مرتين (طبقة حماية ثانية بعد انتقال الحالة الشرطي).
movementSchema.index(
  { orderId: 1, variantId: 1, movementType: 1 },
  { unique: true, partialFilterExpression: { orderId: { $exists: true } } },
);

makeAppendOnly(movementSchema, "سجل حركات المخزون لا يُعدّل ولا يُحذف.");

export const InventoryMovementModel = defineModel<InventoryMovement, InventoryMovementModel>(
  "InventoryMovement",
  movementSchema,
);
