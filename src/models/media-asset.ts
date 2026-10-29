import { Schema, type HydratedDocument, type Model } from "mongoose";
import {
  CLOUDINARY_URL_PATTERN,
  MEDIA_FOLDERS,
  MEDIA_STATUSES,
  type MediaFolder,
} from "@/lib/validation-rules";
import { defineModel, integerValidator } from "@/models/_mongoose";

/**
 * تتبع الصور المرفوعة إلى Cloudinary. pending = رُفعت ولم تُربط بعد بأي كيان؛
 * الأصول المعلقة الأقدم من 24 ساعة تُنظَّف. راجع docs/decisions/0007-server-side-image-upload.md.
 */

export interface MediaAsset {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  folder: MediaFolder;
  status: (typeof MEDIA_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

export type MediaAssetDocument = HydratedDocument<MediaAsset>;
export type MediaAssetModel = Model<MediaAsset>;

const mediaAssetSchema = new Schema<MediaAsset, MediaAssetModel>(
  {
    publicId: { type: String, required: true, trim: true, immutable: true },
    secureUrl: { type: String, required: true, match: CLOUDINARY_URL_PATTERN },
    format: { type: String, required: true, enum: ["jpg", "jpeg", "png", "webp", "avif"] },
    bytes: { type: Number, required: true, min: 1, validate: integerValidator },
    width: { type: Number, required: true, min: 1, validate: integerValidator },
    height: { type: Number, required: true, min: 1, validate: integerValidator },
    folder: { type: String, enum: MEDIA_FOLDERS, required: true },
    status: { type: String, enum: MEDIA_STATUSES, default: "pending" },
  },
  { timestamps: true },
);

mediaAssetSchema.index({ publicId: 1 }, { unique: true });
mediaAssetSchema.index({ status: 1, createdAt: 1 });

export const MediaAssetModel = defineModel<MediaAsset, MediaAssetModel>(
  "MediaAsset",
  mediaAssetSchema,
);
