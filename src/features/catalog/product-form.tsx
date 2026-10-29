"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageManager } from "@/components/admin/image-manager";
import { buttonClass, describedBy, Field, inputClass } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import { createProductAction, updateProductAction } from "@/features/catalog/actions";
import type { FieldErrors } from "@/lib/errors";
import { parsePoundsToPiasters, piastersToDecimalString } from "@/lib/money";
import { LIMITS } from "@/lib/validation-rules";
import type { ProductEditData } from "@/server/admin/products.admin.service";

type Option = { id: string; name: string };

type VariantDraft = {
  key: string;
  id?: string;
  sizeMl: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  initialStock: string;
  lowStockThreshold: string;
  isAvailable: boolean;
  stockQuantity?: number;
};

type ImageDraft = ProductEditData["images"][number];

const toPounds = (piasters: number | null) =>
  piasters === null ? "" : piastersToDecimalString(piasters).replace(/\.00$/, "");

let keyCounter = 0;
const nextKey = () => `v${++keyCounter}`;

const emptyVariant = (): VariantDraft => ({
  key: nextKey(),
  sizeMl: "",
  sku: "",
  price: "",
  compareAtPrice: "",
  initialStock: "0",
  lowStockThreshold: "3",
  isAvailable: true,
});

/** نموذج إضافة/تعديل منتج. التحقق النهائي على الخادم؛ هنا تحويل الأسعار وعرض الأخطاء فقط. */
export function ProductForm({
  product,
  categories,
  brands,
}: {
  product?: ProductEditData;
  categories: Option[];
  brands: Option[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [isPublished, setIsPublished] = useState(product?.isPublished ?? false);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [hideFromOffers, setHideFromOffers] = useState(product?.hideFromOffers ?? false);
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));
  const [seoTitle, setSeoTitle] = useState(product?.seo.title ?? "");
  const [seoDescription, setSeoDescription] = useState(product?.seo.description ?? "");
  const [images, setImages] = useState<ImageDraft[]>(product?.images ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product
      ? product.variants.map((v) => ({
          key: nextKey(),
          id: v.id,
          sizeMl: String(v.sizeMl),
          sku: v.sku,
          price: toPounds(v.price),
          compareAtPrice: toPounds(v.compareAtPrice),
          initialStock: "0",
          lowStockThreshold: String(v.lowStockThreshold),
          isAvailable: v.isAvailable,
          stockQuantity: v.stockQuantity,
        }))
      : [emptyVariant()],
  );

  const err = (path: string) => errors[path];
  const slugChangedWhilePublished = Boolean(product?.isPublished && slug !== product.slug);

  const updateVariant = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((current) => current.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const localErrors: FieldErrors = {};
    const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

    const variantPayload = variants.map((variant, index) => {
      const price = parsePoundsToPiasters(variant.price);
      const compareAt = variant.compareAtPrice.trim()
        ? parsePoundsToPiasters(variant.compareAtPrice)
        : undefined;
      if (price === null) localErrors[`variants.${index}.price`] = ["أدخل سعرًا صحيحًا بالجنيه."];
      if (compareAt === null) {
        localErrors[`variants.${index}.compareAtPrice`] = ["أدخل سعرًا صحيحًا بالجنيه."];
      }
      return {
        ...(variant.id ? { id: variant.id } : {}),
        sizeMl: toInt(variant.sizeMl),
        sku: variant.sku,
        price: price ?? Number.NaN,
        ...(compareAt ? { compareAtPrice: compareAt } : {}),
        initialStock: variant.id ? 0 : toInt(variant.initialStock),
        lowStockThreshold: toInt(variant.lowStockThreshold),
        isAvailable: variant.isAvailable,
      };
    });

    // لا نتوقف عند أخطاء الأسعار المحلية: نرسل للخادم ليُظهر كل أخطاء النموذج دفعة واحدة،
    // ثم نعرض رسائل الأسعار المحلية (أوضح للمستخدم) فوق رسائل الخادم لنفس الحقول.
    const payload = {
      name,
      ...(slug.trim() ? { slug: slug.trim() } : {}),
      shortDescription,
      description,
      categoryId,
      brandId,
      images,
      variants: variantPayload,
      isPublished,
      isFeatured,
      hideFromOffers,
      sortOrder: toInt(sortOrder),
      seo: { title: seoTitle, description: seoDescription },
    };

    startTransition(async () => {
      const result = product
        ? await updateProductAction(product.id, payload)
        : await createProductAction(payload);
      if (!result.ok) {
        setErrors({ ...(result.error.fieldErrors ?? {}), ...localErrors });
        notify(result.error.message, "error");
        if (result.error.code === "UNAUTHORIZED") router.push("/admin/login");
        return;
      }
      setErrors({});
      if (product) {
        setSlug(result.data.slug);
        notify("حُفظت التعديلات.", "success");
        router.refresh();
      } else {
        notify("أُضيف المنتج.", "success");
        router.push(`/admin/products/${result.data.id}`);
      }
    });
  };

  const formErrors = Object.entries(errors)
    .filter(([key]) => key === "_form" || key === "isPublished" || key === "images" || key === "variants")
    .flatMap(([, messages]) => messages);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate aria-busy={isPending}>
      {formErrors.length > 0 ? (
        <div role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {formErrors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60 md:grid-cols-2">
        <h2 className="text-lg md:col-span-2">البيانات الأساسية</h2>
        <Field id="pf-name" label="اسم العطر" required errors={err("name")}>
          <input
            id="pf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(err("name"))}
            aria-describedby={describedBy("pf-name", err("name"))}
            maxLength={120}
          />
        </Field>
        <Field
          id="pf-slug"
          label="الرابط (slug)"
          hint={
            slugChangedWhilePublished
              ? "تنبيه: تغيير رابط منتج منشور يكسر الروابط القديمة المشتركة."
              : "اتركه فارغًا ليُقترح من الاسم. حروف وأرقام وشرطات فقط."
          }
          errors={err("slug")}
        >
          <input
            id="pf-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(err("slug"))}
            aria-describedby={describedBy("pf-slug", err("slug"), "hint")}
            maxLength={96}
          />
        </Field>
        <Field id="pf-category" label="التصنيف" required errors={err("categoryId")}>
          <select
            id="pf-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(err("categoryId"))}
            aria-describedby={describedBy("pf-category", err("categoryId"))}
          >
            <option value="">اختر التصنيف</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pf-brand" label="الماركة" required errors={err("brandId")}>
          <select
            id="pf-brand"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(err("brandId"))}
            aria-describedby={describedBy("pf-brand", err("brandId"))}
          >
            <option value="">اختر الماركة</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field id="pf-short" label="الوصف المختصر" required errors={err("shortDescription")}>
            <textarea
              id="pf-short"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className={inputClass}
              aria-invalid={Boolean(err("shortDescription"))}
              aria-describedby={describedBy("pf-short", err("shortDescription"))}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field
            id="pf-description"
            label="الوصف التفصيلي"
            hint="افصل الفقرات بسطر فارغ."
            errors={err("description")}
          >
            <textarea
              id="pf-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              maxLength={10_000}
              className={inputClass}
              aria-describedby={describedBy("pf-description", err("description"), "hint")}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">الأحجام والأسعار</h2>
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={() => setVariants((current) => [...current, emptyVariant()])}
            disabled={variants.length >= 10}
          >
            إضافة حجم
          </button>
        </div>
        <p className="text-xs text-muted">
          الأسعار بالجنيه المصري. «السعر قبل الخصم» اختياري ويجب أن يكون أكبر من السعر. الكمية الأولية
          للأحجام الجديدة فقط؛ تعديل مخزون الأحجام الحالية من إدارة المخزون (المرحلة التالية).
        </p>
        {variants.map((variant, index) => {
          const p = `variants.${index}`;
          const fid = (field: string) => `pf-v${variant.key}-${field}`;
          return (
            <fieldset
              key={variant.key}
              className="grid gap-3 rounded-md border border-sand p-4 sm:grid-cols-2 lg:grid-cols-4"
              data-testid="variant-row"
            >
              <legend className="px-1 text-sm font-bold text-espresso">
                حجم {index + 1}
                {variant.stockQuantity !== undefined ? (
                  <span className="ms-2 font-normal text-muted">
                    (المخزون الحالي: {variant.stockQuantity})
                  </span>
                ) : null}
              </legend>
              <Field id={fid("size")} label="الحجم (مل)" required errors={err(`${p}.sizeMl`)}>
                <input
                  id={fid("size")}
                  inputMode="numeric"
                  value={variant.sizeMl}
                  onChange={(e) => updateVariant(variant.key, { sizeMl: e.target.value })}
                  className={inputClass}
                  aria-invalid={Boolean(err(`${p}.sizeMl`))}
                  aria-describedby={describedBy(fid("size"), err(`${p}.sizeMl`))}
                />
              </Field>
              <Field id={fid("price")} label="السعر (ج.م)" required errors={err(`${p}.price`)}>
                <input
                  id={fid("price")}
                  inputMode="decimal"
                  value={variant.price}
                  onChange={(e) => updateVariant(variant.key, { price: e.target.value })}
                  className={inputClass}
                  aria-invalid={Boolean(err(`${p}.price`))}
                  aria-describedby={describedBy(fid("price"), err(`${p}.price`))}
                />
              </Field>
              <Field
                id={fid("compare")}
                label="السعر قبل الخصم (ج.م)"
                errors={err(`${p}.compareAtPrice`)}
              >
                <input
                  id={fid("compare")}
                  inputMode="decimal"
                  value={variant.compareAtPrice}
                  onChange={(e) => updateVariant(variant.key, { compareAtPrice: e.target.value })}
                  className={inputClass}
                  aria-invalid={Boolean(err(`${p}.compareAtPrice`))}
                  aria-describedby={describedBy(fid("compare"), err(`${p}.compareAtPrice`))}
                />
              </Field>
              <Field id={fid("sku")} label="SKU (اختياري)" errors={err(`${p}.sku`)}>
                <input
                  id={fid("sku")}
                  dir="ltr"
                  value={variant.sku}
                  onChange={(e) => updateVariant(variant.key, { sku: e.target.value })}
                  className={inputClass}
                  aria-invalid={Boolean(err(`${p}.sku`))}
                  aria-describedby={describedBy(fid("sku"), err(`${p}.sku`))}
                />
              </Field>
              {variant.id ? null : (
                <Field id={fid("stock")} label="الكمية الأولية" errors={err(`${p}.initialStock`)}>
                  <input
                    id={fid("stock")}
                    inputMode="numeric"
                    value={variant.initialStock}
                    onChange={(e) => updateVariant(variant.key, { initialStock: e.target.value })}
                    className={inputClass}
                    aria-invalid={Boolean(err(`${p}.initialStock`))}
                    aria-describedby={describedBy(fid("stock"), err(`${p}.initialStock`))}
                  />
                </Field>
              )}
              <Field
                id={fid("threshold")}
                label="حد تنبيه المخزون"
                errors={err(`${p}.lowStockThreshold`)}
              >
                <input
                  id={fid("threshold")}
                  inputMode="numeric"
                  value={variant.lowStockThreshold}
                  onChange={(e) => updateVariant(variant.key, { lowStockThreshold: e.target.value })}
                  className={inputClass}
                  aria-describedby={describedBy(fid("threshold"), err(`${p}.lowStockThreshold`))}
                />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={variant.isAvailable}
                  onChange={(e) => updateVariant(variant.key, { isAvailable: e.target.checked })}
                  className="size-4 accent-[var(--color-gold)]"
                />
                متاح للبيع
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className={buttonClass.ghost}
                  disabled={variants.length <= 1}
                  onClick={() =>
                    setVariants((current) => current.filter((v) => v.key !== variant.key))
                  }
                >
                  حذف الحجم
                </button>
              </div>
            </fieldset>
          );
        })}
      </section>

      <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60">
        <h2 className="text-lg">الصور</h2>
        <p className="text-sm text-muted">الصورة الأولى هي الرئيسية. اسحب الصور أو استخدم الأزرار لترتيبها. النشر يتطلب صورة واحدة على الأقل.</p>
        <ImageManager
          images={images}
          onChange={setImages}
          folder="products"
          max={LIMITS.imagesPerProduct}
          errors={err("images")}
        />
      </section>

      <section className="grid gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60 md:grid-cols-2">
        <h2 className="text-lg md:col-span-2">العرض وSEO</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="size-4 accent-[var(--color-gold)]" />
            منشور في المتجر
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="size-4 accent-[var(--color-gold)]" />
            عطر مميز (يظهر في الرئيسية)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideFromOffers} onChange={(e) => setHideFromOffers(e.target.checked)} className="size-4 accent-[var(--color-gold)]" />
            إخفاء من قسم العروض رغم وجود خصم
          </label>
        </div>
        <Field id="pf-sort" label="ترتيب العرض" hint="الأصغر يظهر أولًا بين المميز." errors={err("sortOrder")}>
          <input
            id="pf-sort"
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
            aria-describedby={describedBy("pf-sort", err("sortOrder"), "hint")}
          />
        </Field>
        <Field id="pf-seo-title" label="عنوان SEO" hint="اختياري، حتى 70 حرفًا. الافتراضي اسم العطر." errors={err("seo.title")}>
          <input
            id="pf-seo-title"
            value={seoTitle}
            maxLength={70}
            onChange={(e) => setSeoTitle(e.target.value)}
            className={inputClass}
            aria-describedby={describedBy("pf-seo-title", err("seo.title"), "hint")}
          />
        </Field>
        <Field id="pf-seo-desc" label="وصف SEO" hint="اختياري، حتى 160 حرفًا." errors={err("seo.description")}>
          <textarea
            id="pf-seo-desc"
            value={seoDescription}
            maxLength={160}
            rows={2}
            onChange={(e) => setSeoDescription(e.target.value)}
            className={inputClass}
            aria-describedby={describedBy("pf-seo-desc", err("seo.description"), "hint")}
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClass.primary}>
          {isPending ? "جارٍ الحفظ…" : product ? "حفظ التعديلات" : "إضافة المنتج"}
        </button>
        <Link href="/admin/products" className={buttonClass.secondary}>
          رجوع للقائمة
        </Link>
        {product?.isPublished ? (
          <Link href={`/perfumes/${product.slug}`} target="_blank" className={buttonClass.ghost}>
            عرض في المتجر ↗
          </Link>
        ) : null}
      </div>
    </form>
  );
}
