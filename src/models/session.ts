import { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import { SHA256_HEX_PATTERN } from "@/lib/validation-rules";
import { defineModel } from "@/models/_mongoose";

/**
 * جلسات الأدمن. يُخزن hash التوكن فقط (SHA-256)، والتوكن نفسه في كوكي HttpOnly.
 * فهرس TTL يحذف الجلسة تلقائيًا عند expiresAt. راجع docs/SECURITY.md §2.3.
 */

export interface Session {
  tokenHash: string;
  adminId: Types.ObjectId;
  expiresAt: Date;
  lastSeenAt: Date;
  userAgent?: string;
  createdAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export type SessionModel = Model<Session>;

const sessionSchema = new Schema<Session, SessionModel>(
  {
    tokenHash: {
      type: String,
      required: true,
      match: [SHA256_HEX_PATTERN, "صيغة الجلسة غير صالحة."],
      immutable: true,
    },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true, immutable: true },
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true, default: () => new Date() },
    userAgent: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ adminId: 1 });

export const SessionModel = defineModel<Session, SessionModel>("Session", sessionSchema);
