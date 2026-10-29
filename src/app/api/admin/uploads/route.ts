import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { MEDIA_FOLDERS, type MediaFolder } from "@/lib/validation-rules";
import { requireAdmin } from "@/server/auth/require-admin";
import { isSameOrigin, jsonError } from "@/server/http";
import { MAX_UPLOAD_BYTES, uploadImage } from "@/server/media.service";
import { consumeRateLimit, RATE_LIMITS } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * رفع صورة من لوحة الإدارة (multipart: file، folder). الترتيب مقصود:
 * الجلسة ← Origin ← معدل الرفع ← الحجم المعلن ← قراءة الملف ← فحص النوع الفعلي ← Cloudinary.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!isSameOrigin(request)) throw new AppError("FORBIDDEN", "طلب غير مسموح.");

    const limit = await consumeRateLimit("upload", admin.id, RATE_LIMITS.upload);
    if (!limit.allowed) {
      throw new AppError("RATE_LIMITED", "رفعت صورًا كثيرة خلال وقت قصير. حاول بعد قليل.");
    }

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
      throw new AppError("FILE_TOO_LARGE", "حجم الصورة أكبر من 4 ميجابايت.");
    }

    const form = await request.formData();
    const file = form.get("file");
    const folder = form.get("folder");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "اختر ملف صورة.");
    if (typeof folder !== "string" || !MEDIA_FOLDERS.includes(folder as MediaFolder)) {
      throw new AppError("VALIDATION", "وجهة الصورة غير صالحة.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppError("FILE_TOO_LARGE", "حجم الصورة أكبر من 4 ميجابايت.");
    }

    const image = await uploadImage(Buffer.from(await file.arrayBuffer()), folder as MediaFolder);
    return NextResponse.json({ ok: true, image }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
