import "server-only";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { getAppUrl, getCloudinaryEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * تخزين الصور. السائق الافتراضي Cloudinary (الرفع من الخادم فقط — API Secret لا يغادر الخادم).
 * السائق "memory" لاختبارات E2E المحلية فقط: لا يتصل بالشبكة، ويُرفض تشغيله إلا إن كان
 * APP_URL على localhost، فلا يمكن تفعيله في بيئة منشورة.
 */

export const MEDIA_ROOT_FOLDER = "abak-elkhalig";

export type StoredImage = {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
};

export type MediaStorage = {
  upload(bytes: Buffer, folder: string): Promise<StoredImage>;
  destroy(publicId: string): Promise<void>;
};

function cloudinaryStorage(): MediaStorage {
  const env = getCloudinaryEnv();
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return {
    upload: (bytes, folder) =>
      new Promise<StoredImage>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${MEDIA_ROOT_FOLDER}/${folder}`,
            resource_type: "image",
            unique_filename: true,
            overwrite: false,
          },
          (error, result?: UploadApiResponse) => {
            if (error || !result) {
              reject(error ?? new Error("Cloudinary upload failed"));
              return;
            }
            resolve({
              publicId: result.public_id,
              secureUrl: result.secure_url,
              format: result.format,
              bytes: result.bytes,
              width: result.width,
              height: result.height,
            });
          },
        );
        stream.end(bytes);
      }),
    destroy: async (publicId) => {
      const result = (await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
        resource_type: "image",
      })) as { result?: string };
      if (result.result !== "ok" && result.result !== "not found") {
        throw new Error(`Cloudinary destroy failed: ${result.result ?? "unknown"}`);
      }
    },
  };
}

function memoryStorage(): MediaStorage {
  const host = getAppUrl().hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("MEDIA_STORAGE=memory مسموح فقط عندما يكون APP_URL على localhost.");
  }
  return {
    upload: async (bytes, folder) => {
      const publicId = `${MEDIA_ROOT_FOLDER}/${folder}/${randomUUID()}`;
      return {
        publicId,
        secureUrl: `https://res.cloudinary.com/abak-local/image/upload/${publicId}.webp`,
        format: "webp",
        bytes: bytes.length,
        width: 800,
        height: 800,
      };
    },
    destroy: async () => undefined,
  };
}

let storage: MediaStorage | undefined;

export function getMediaStorage(): MediaStorage {
  if (!storage) {
    const useMemory = process.env.MEDIA_STORAGE === "memory";
    storage = useMemory ? memoryStorage() : cloudinaryStorage();
    if (useMemory) logger.warn("سائق الصور المحلي (memory) مفعّل — للاختبارات المحلية فقط");
  }
  return storage;
}
