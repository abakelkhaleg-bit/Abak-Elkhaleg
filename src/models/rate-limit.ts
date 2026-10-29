import { Schema, type Model } from "mongoose";
import { defineModel } from "@/models/_mongoose";

/** عدادات تحديد معدل الطلبات. _id = "<bucket>:<keyHash>". راجع docs/SECURITY.md §3. */

export interface RateLimit {
  _id: string;
  count: number;
  expiresAt: Date;
}

export type RateLimitModel = Model<RateLimit>;

const rateLimitSchema = new Schema<RateLimit, RateLimitModel>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitModel = defineModel<RateLimit, RateLimitModel>("RateLimit", rateLimitSchema);
