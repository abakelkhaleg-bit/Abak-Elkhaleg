"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageManager, type ManagedImage } from "@/components/admin/image-manager";
import { buttonClass, describedBy, Field, inputClass } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import { createTaxonomyAction, updateTaxonomyAction } from "@/features/catalog/actions";
import type { FieldErrors } from "@/lib/errors";
import type { AdminTaxonomyRow, TaxonomyKind } from "@/server/admin/taxonomy.admin.service";

const LABELS = {
  category: { noun: "التصنيف", image: "صورة التصنيف", folder: "categories", list: "/admin/categories", created: "أُضيف التصنيف." },
  brand: { noun: "الماركة", image: "شعار الماركة", folder: "brands", list: "/admin/brands", created: "أُضيفت الماركة." },
} as const;

/** نموذج تصنيف/ماركة. الصورة أو الشعار يُرفعان عبر مدير الصور. */
export function TaxonomyForm({ kind, item }: { kind: TaxonomyKind; item?: AdminTaxonomyRow }) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [name, setName] = useState(item?.name ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [seoTitle, setSeoTitle] = useState(item?.seo.title ?? "");
  const [seoDescription, setSeoDescription] = useState(item?.seo.description ?? "");
  const [image, setImage] = useState<ManagedImage[]>(item?.image ? [item.image] : []);
  const labels = LABELS[kind];
  const err = (path: string) => errors[path];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name,
      ...(slug.trim() ? { slug: slug.trim() } : {}),
      description,
      isActive,
      sortOrder: /^\d+$/.test(sortOrder) ? Number(sortOrder) : Number.NaN,
      seo: { title: seoTitle, description: seoDescription },
      ...(image[0] ? { [kind === "category" ? "image" : "logo"]: image[0] } : {}),
    };
    startTransition(async () => {
      const result = item
        ? await updateTaxonomyAction(kind, item.id, payload)
        : await createTaxonomyAction(kind, payload);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        notify(result.error.message, "error");
        if (result.error.code === "UNAUTHORIZED") router.push("/admin/login");
        return;
      }
      setErrors({});
      notify(item ? "حُفظت التعديلات." : labels.created, "success");
      router.push(labels.list);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={isPending}
      className="grid gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60 md:grid-cols-2"
    >
      <Field id="tf-name" label="الاسم" required errors={err("name")}>
        <input
          id="tf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className={inputClass}
          aria-invalid={Boolean(err("name"))}
          aria-describedby={describedBy("tf-name", err("name"))}
        />
      </Field>
      <Field id="tf-slug" label="الرابط (slug)" hint="اتركه فارغًا ليُقترح من الاسم." errors={err("slug")}>
        <input
          id="tf-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          maxLength={96}
          className={inputClass}
          aria-invalid={Boolean(err("slug"))}
          aria-describedby={describedBy("tf-slug", err("slug"), "hint")}
        />
      </Field>
      <div className="md:col-span-2">
        <Field id="tf-description" label="الوصف" errors={err("description")}>
          <textarea
            id="tf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            className={inputClass}
            aria-describedby={describedBy("tf-description", err("description"))}
          />
        </Field>
      </div>
      <div className="md:col-span-2">
        <h2 className="mb-2 text-base font-bold">{labels.image}</h2>
        <ImageManager
          images={image}
          onChange={setImage}
          folder={labels.folder}
          max={1}
          label={labels.image}
          errors={err(kind === "category" ? "image" : "logo")}
        />
      </div>
      <Field id="tf-sort" label="ترتيب العرض" hint="الأصغر يظهر أولًا." errors={err("sortOrder")}>
        <input
          id="tf-sort"
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={inputClass}
          aria-describedby={describedBy("tf-sort", err("sortOrder"), "hint")}
        />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="size-4 accent-[var(--color-gold)]"
        />
        ظاهر في المتجر
      </label>
      <Field id="tf-seo-title" label="عنوان SEO" hint="اختياري، حتى 70 حرفًا." errors={err("seo.title")}>
        <input
          id="tf-seo-title"
          value={seoTitle}
          maxLength={70}
          onChange={(e) => setSeoTitle(e.target.value)}
          className={inputClass}
          aria-describedby={describedBy("tf-seo-title", err("seo.title"), "hint")}
        />
      </Field>
      <Field id="tf-seo-desc" label="وصف SEO" hint="اختياري، حتى 160 حرفًا." errors={err("seo.description")}>
        <textarea
          id="tf-seo-desc"
          value={seoDescription}
          maxLength={160}
          rows={2}
          onChange={(e) => setSeoDescription(e.target.value)}
          className={inputClass}
          aria-describedby={describedBy("tf-seo-desc", err("seo.description"), "hint")}
        />
      </Field>
      <div className="flex flex-wrap gap-3 md:col-span-2">
        <button type="submit" disabled={isPending} className={buttonClass.primary}>
          {isPending ? "جارٍ الحفظ…" : item ? "حفظ التعديلات" : `إضافة ${labels.noun}`}
        </button>
        <Link href={labels.list} className={buttonClass.secondary}>
          رجوع للقائمة
        </Link>
      </div>
    </form>
  );
}
