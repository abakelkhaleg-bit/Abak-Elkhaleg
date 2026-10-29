"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { buttonClass, inputClass } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import type { MediaFolder } from "@/lib/validation-rules";

export type ManagedImage = { secureUrl: string; publicId: string; altText: string };

type UploadResponse =
  | { ok: true; image: { secureUrl: string; publicId: string } }
  | { ok: false; error?: { message?: string } };

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * مدير الصور في لوحة الإدارة: رفع (عبر /api/admin/uploads — الفحص الحقيقي على الخادم)،
 * ومعاينة، وترتيب بالسحب وبالأزرار (لإمكانية الوصول)، وتعيين الرئيسية، والنص البديل، والإزالة.
 * الإزالة هنا من النموذج فقط؛ الحذف من Cloudinary يتم على الخادم بعد نجاح الحفظ.
 */
export function ImageManager({
  images,
  onChange,
  folder,
  max,
  label = "الصور",
  errors,
}: {
  images: ManagedImage[];
  onChange: (next: ManagedImage[]) => void;
  folder: MediaFolder;
  max: number;
  label?: string;
  errors?: string[];
}) {
  const { notify } = useToast();
  const inputId = useId();
  const statusId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [status, setStatus] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const single = max === 1;
  const remaining = max - images.length;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onChange(next);
    setStatus(`نُقلت الصورة إلى الموضع ${to + 1}.`);
  };

  const uploadOne = async (file: File): Promise<ManagedImage | null> => {
    if (file.size > MAX_BYTES) {
      notify(`«${file.name}»: حجم الصورة أكبر من 4 ميجابايت.`, "error");
      return null;
    }
    const body = new FormData();
    body.set("file", file);
    body.set("folder", folder);
    try {
      const response = await fetch("/api/admin/uploads", { method: "POST", body });
      const data = (await response.json()) as UploadResponse;
      if (!data.ok) {
        notify(`«${file.name}»: ${data.error?.message ?? "تعذر رفع الصورة."}`, "error");
        return null;
      }
      return { secureUrl: data.image.secureUrl, publicId: data.image.publicId, altText: "" };
    } catch {
      notify(`«${file.name}»: تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.`, "error");
      return null;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = single ? [...files].slice(0, 1) : [...files].slice(0, Math.max(0, remaining));
    if (!single && files.length > selected.length) {
      notify(`الحد الأقصى ${max} صور؛ رُفعت أول ${selected.length} فقط.`, "error");
    }
    setUploading(selected.length);
    setStatus("جارٍ رفع الصور…");
    const uploaded: ManagedImage[] = [];
    for (const file of selected) {
      const image = await uploadOne(file);
      if (image) uploaded.push(image);
      setUploading((n) => n - 1);
    }
    if (fileRef.current) fileRef.current.value = "";
    if (uploaded.length > 0) {
      onChange(single ? uploaded.slice(0, 1) : [...images, ...uploaded]);
      const message = `رُفعت ${uploaded.length} صورة. احفظ النموذج لتثبيتها.`;
      setStatus(message);
      notify(message, "success");
    } else {
      setStatus("");
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid={`image-manager-${folder}`}>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-espresso">
          {single ? (images.length > 0 ? `استبدال ${label}` : `رفع ${label}`) : `إضافة ${label}`}
        </label>
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          multiple={!single}
          disabled={uploading > 0 || (!single && remaining <= 0)}
          onChange={(e) => void handleFiles(e.target.files)}
          className="text-sm file:me-3 file:rounded-md file:border-0 file:bg-cream file:px-3 file:py-2 file:text-sm file:font-medium file:text-espresso"
          aria-describedby={statusId}
        />
      </div>
      <p id={statusId} className="text-xs text-muted" aria-live="polite">
        {uploading > 0
          ? `جارٍ الرفع… (متبقٍ ${uploading})`
          : status ||
            `JPEG أو PNG أو WebP أو AVIF، حتى 4 ميجابايت${single ? "" : `، وحتى ${max} صور`}.`}
      </p>
      {errors?.map((message) => (
        <p key={message} className="text-sm text-danger" role="alert">
          {message}
        </p>
      ))}

      {images.length === 0 ? (
        <p className="text-sm text-muted">لا توجد صور بعد.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <li
              key={image.publicId}
              data-testid="managed-image"
              draggable={!single}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex flex-col gap-2 rounded-md border p-3 ${
                dragIndex === index ? "border-gold opacity-60" : "border-sand"
              } ${single ? "" : "cursor-grab"}`}
            >
              <div className="relative aspect-square overflow-hidden rounded bg-cream">
                <Image
                  src={image.secureUrl}
                  alt={image.altText}
                  fill
                  sizes="240px"
                  className="object-cover"
                />
                {!single && index === 0 ? (
                  <span className="absolute start-2 top-2 rounded-sm bg-gold px-2 py-0.5 text-xs font-bold text-white">
                    الرئيسية
                  </span>
                ) : null}
              </div>
              <label className="text-xs text-muted" htmlFor={`${inputId}-alt-${index}`}>
                النص البديل
              </label>
              <input
                id={`${inputId}-alt-${index}`}
                value={image.altText}
                maxLength={150}
                onChange={(e) =>
                  onChange(
                    images.map((img, i) => (i === index ? { ...img, altText: e.target.value } : img)),
                  )
                }
                className={inputClass}
              />
              <div className="flex flex-wrap gap-1">
                {single ? null : (
                  <>
                    <button
                      type="button"
                      className={buttonClass.ghost}
                      disabled={index === 0}
                      onClick={() => move(index, 0)}
                    >
                      اجعلها الرئيسية
                    </button>
                    <button
                      type="button"
                      className={buttonClass.ghost}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={`تقديم الصورة ${index + 1}`}
                    >
                      تقديم
                    </button>
                    <button
                      type="button"
                      className={buttonClass.ghost}
                      disabled={index === images.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={`تأخير الصورة ${index + 1}`}
                    >
                      تأخير
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={buttonClass.ghost}
                  onClick={() => {
                    onChange(images.filter((_, i) => i !== index));
                    setStatus("أُزيلت الصورة. احفظ النموذج لتثبيت الإزالة.");
                  }}
                  aria-label={`إزالة الصورة ${index + 1}`}
                >
                  إزالة
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
