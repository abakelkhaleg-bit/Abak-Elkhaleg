"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass, describedBy, Field, inputClass } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import { updateSettingsAction } from "@/features/settings/actions";
import type { FieldErrors } from "@/lib/errors";
import type { SettingsEditData } from "@/server/admin/settings.admin.service";

const SOCIAL = [
  { key: "instagram", label: "إنستجرام" },
  { key: "facebook", label: "فيسبوك" },
  { key: "tiktok", label: "تيك توك" },
  { key: "x", label: "إكس" },
  { key: "snapchat", label: "سناب شات" },
] as const;

type Policy = SettingsEditData["policies"][number] & { key: string };
let policyKey = 0;

/** نموذج إعدادات المتجر. رقم واتساب يُدخل بصيغة مصرية ويُخزن بصيغة wa.me على الخادم. */
export function SettingsForm({ initial }: { initial: SettingsEditData }) {
  const router = useRouter();
  const { notify } = useToast();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [data, setData] = useState(initial);
  const [policies, setPolicies] = useState<Policy[]>(
    initial.policies.map((p) => ({ ...p, key: `p${++policyKey}` })),
  );
  const err = (path: string) => errors[path];

  const set = <K extends keyof SettingsEditData>(key: K, value: SettingsEditData[K]) =>
    setData((current) => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      storeName: data.storeName,
      whatsappNumber: data.whatsappLocal,
      contact: data.contact,
      description: data.description,
      defaultSeo: data.defaultSeo,
      socialLinks: data.socialLinks,
      homepage: data.homepage,
      policies: policies.map(({ slug, title, body }) => ({ slug, title, body })),
    };
    startTransition(async () => {
      const result = await updateSettingsAction(payload);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        notify(result.error.message, "error");
        if (result.error.code === "UNAUTHORIZED") router.push("/admin/login");
        return;
      }
      setErrors({});
      notify("حُفظت إعدادات المتجر.", "success");
      router.refresh();
    });
  };

  const section = "grid gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60 md:grid-cols-2";

  return (
    <form onSubmit={submit} noValidate aria-busy={isPending} className="flex flex-col gap-6">
      <section className={section}>
        <h2 className="text-lg md:col-span-2">بيانات المتجر</h2>
        <Field id="sf-name" label="اسم المتجر" required errors={err("storeName")}>
          <input
            id="sf-name"
            value={data.storeName}
            onChange={(e) => set("storeName", e.target.value)}
            className={inputClass}
            maxLength={80}
            aria-describedby={describedBy("sf-name", err("storeName"))}
          />
        </Field>
        <Field
          id="sf-whatsapp"
          label="رقم واتساب لاستقبال الطلبات"
          hint="رقم موبايل مصري، مثال: 01012345678. بدونه يبقى زر الطلب معطلًا."
          errors={err("whatsappNumber")}
        >
          <input
            id="sf-whatsapp"
            dir="ltr"
            inputMode="tel"
            value={data.whatsappLocal}
            onChange={(e) => set("whatsappLocal", e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(err("whatsappNumber"))}
            aria-describedby={describedBy("sf-whatsapp", err("whatsappNumber"), "hint")}
          />
        </Field>
        <div className="md:col-span-2">
          <Field id="sf-description" label="وصف المتجر" hint="يظهر في الـFooter وقسم «عن المتجر»." errors={err("description")}>
            <textarea
              id="sf-description"
              rows={3}
              maxLength={1000}
              value={data.description}
              onChange={(e) => set("description", e.target.value)}
              className={inputClass}
              aria-describedby={describedBy("sf-description", err("description"), "hint")}
            />
          </Field>
        </div>
      </section>

      <section className={section}>
        <h2 className="text-lg md:col-span-2">بيانات التواصل</h2>
        {(
          [
            ["phone", "الهاتف", "ltr"],
            ["email", "البريد الإلكتروني", "ltr"],
            ["address", "العنوان", "rtl"],
            ["workingHours", "مواعيد العمل", "rtl"],
          ] as const
        ).map(([key, label, dir]) => (
          <Field key={key} id={`sf-contact-${key}`} label={label} errors={err(`contact.${key}`)}>
            <input
              id={`sf-contact-${key}`}
              dir={dir}
              value={data.contact[key]}
              onChange={(e) => set("contact", { ...data.contact, [key]: e.target.value })}
              className={inputClass}
              aria-describedby={describedBy(`sf-contact-${key}`, err(`contact.${key}`))}
            />
          </Field>
        ))}
        {SOCIAL.map(({ key, label }) => (
          <Field key={key} id={`sf-social-${key}`} label={`رابط ${label}`} hint="يبدأ بـ https://" errors={err(`socialLinks.${key}`)}>
            <input
              id={`sf-social-${key}`}
              dir="ltr"
              value={data.socialLinks[key]}
              onChange={(e) => set("socialLinks", { ...data.socialLinks, [key]: e.target.value })}
              className={inputClass}
              aria-invalid={Boolean(err(`socialLinks.${key}`))}
              aria-describedby={describedBy(`sf-social-${key}`, err(`socialLinks.${key}`), "hint")}
            />
          </Field>
        ))}
      </section>

      <section className={section}>
        <h2 className="text-lg md:col-span-2">الصفحة الرئيسية وSEO الافتراضي</h2>
        <Field id="sf-hero-title" label="عنوان الـHero" hint="الافتراضي: عطور تليق بحضورك" errors={err("homepage.heroTitle")}>
          <input
            id="sf-hero-title"
            value={data.homepage.heroTitle}
            maxLength={120}
            onChange={(e) => set("homepage", { ...data.homepage, heroTitle: e.target.value })}
            className={inputClass}
            aria-describedby={describedBy("sf-hero-title", err("homepage.heroTitle"), "hint")}
          />
        </Field>
        <Field id="sf-hero-sub" label="نص الـHero" errors={err("homepage.heroSubtitle")}>
          <input
            id="sf-hero-sub"
            value={data.homepage.heroSubtitle}
            maxLength={300}
            onChange={(e) => set("homepage", { ...data.homepage, heroSubtitle: e.target.value })}
            className={inputClass}
            aria-describedby={describedBy("sf-hero-sub", err("homepage.heroSubtitle"))}
          />
        </Field>
        <Field id="sf-seo-title" label="عنوان SEO الافتراضي" hint="حتى 70 حرفًا." errors={err("defaultSeo.title")}>
          <input
            id="sf-seo-title"
            value={data.defaultSeo.title}
            maxLength={70}
            onChange={(e) => set("defaultSeo", { ...data.defaultSeo, title: e.target.value })}
            className={inputClass}
            aria-describedby={describedBy("sf-seo-title", err("defaultSeo.title"), "hint")}
          />
        </Field>
        <Field id="sf-seo-desc" label="وصف SEO الافتراضي" hint="حتى 160 حرفًا." errors={err("defaultSeo.description")}>
          <textarea
            id="sf-seo-desc"
            rows={2}
            value={data.defaultSeo.description}
            maxLength={160}
            onChange={(e) => set("defaultSeo", { ...data.defaultSeo, description: e.target.value })}
            className={inputClass}
            aria-describedby={describedBy("sf-seo-desc", err("defaultSeo.description"), "hint")}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">صفحات السياسات</h2>
          <button
            type="button"
            className={buttonClass.secondary}
            disabled={policies.length >= 10}
            onClick={() =>
              setPolicies((current) => [...current, { key: `p${++policyKey}`, slug: "", title: "", body: "" }])
            }
          >
            إضافة صفحة
          </button>
        </div>
        <p className="text-xs text-muted">تظهر في الـFooter بروابط /policies/الرابط. مثال: shipping، returns، privacy.</p>
        {policies.length === 0 ? <p className="text-sm text-muted">لا توجد صفحات سياسات.</p> : null}
        {policies.map((policy, index) => {
          const p = `policies.${index}`;
          const update = (patch: Partial<Policy>) =>
            setPolicies((current) => current.map((item) => (item.key === policy.key ? { ...item, ...patch } : item)));
          return (
            <fieldset key={policy.key} className="grid gap-3 rounded-md border border-sand p-4 md:grid-cols-2">
              <legend className="px-1 text-sm font-bold">صفحة {index + 1}</legend>
              <Field id={`sf-p-${policy.key}-title`} label="العنوان" errors={err(`${p}.title`)}>
                <input
                  id={`sf-p-${policy.key}-title`}
                  value={policy.title}
                  onChange={(e) => update({ title: e.target.value })}
                  className={inputClass}
                  aria-describedby={describedBy(`sf-p-${policy.key}-title`, err(`${p}.title`))}
                />
              </Field>
              <Field id={`sf-p-${policy.key}-slug`} label="الرابط" errors={err(`${p}.slug`)}>
                <input
                  id={`sf-p-${policy.key}-slug`}
                  dir="ltr"
                  value={policy.slug}
                  onChange={(e) => update({ slug: e.target.value })}
                  className={inputClass}
                  aria-describedby={describedBy(`sf-p-${policy.key}-slug`, err(`${p}.slug`))}
                />
              </Field>
              <div className="md:col-span-2">
                <Field id={`sf-p-${policy.key}-body`} label="المحتوى" hint="افصل الفقرات بسطر فارغ." errors={err(`${p}.body`)}>
                  <textarea
                    id={`sf-p-${policy.key}-body`}
                    rows={5}
                    value={policy.body}
                    onChange={(e) => update({ body: e.target.value })}
                    className={inputClass}
                    aria-describedby={describedBy(`sf-p-${policy.key}-body`, err(`${p}.body`), "hint")}
                  />
                </Field>
              </div>
              <div>
                <button
                  type="button"
                  className={buttonClass.ghost}
                  onClick={() => setPolicies((current) => current.filter((item) => item.key !== policy.key))}
                >
                  حذف الصفحة
                </button>
              </div>
            </fieldset>
          );
        })}
      </section>

      <div>
        <button type="submit" disabled={isPending} className={buttonClass.primary}>
          {isPending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
        </button>
      </div>
    </form>
  );
}
