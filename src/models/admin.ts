import { Schema, type HydratedDocument, type Model } from "mongoose";
import { USERNAME_PATTERN } from "@/lib/validation-rules";
import { defineModel } from "@/models/_mongoose";

/** حساب الأدمن الوحيد. راجع docs/DATABASE.md §3.6 و docs/SECURITY.md §2. */

export interface Admin {
  /** قيمة ثابتة عليها فهرس فريد — تضمن وجود حساب واحد فقط على مستوى القاعدة. */
  singleton: "admin";
  username: string;
  passwordHash: string;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminDocument = HydratedDocument<Admin>;
export type AdminModel = Model<Admin>;

/** صيغة PHC لخوارزمية Argon2id — أي قيمة أخرى (مثل نص صريح) تُرفض. */
const ARGON2ID_PHC = /^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

const adminSchema = new Schema<Admin, AdminModel>(
  {
    singleton: { type: String, enum: ["admin"], default: "admin", immutable: true },
    username: {
      type: String,
      required: [true, "اسم المستخدم مطلوب."],
      trim: true,
      lowercase: true,
      match: [USERNAME_PATTERN, "اسم المستخدم يجب أن يكون 3–32 حرفًا إنجليزيًا أو أرقامًا أو . _ -"],
    },
    passwordHash: {
      type: String,
      required: true,
      match: [ARGON2ID_PHC, "كلمة المرور يجب أن تُخزن كـ hash بخوارزمية Argon2id."],
      select: false,
    },
    passwordChangedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

adminSchema.index({ singleton: 1 }, { unique: true });

export const AdminModel = defineModel<Admin, AdminModel>("Admin", adminSchema);
