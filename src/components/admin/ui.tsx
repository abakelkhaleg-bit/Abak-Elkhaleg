import Link from "next/link";
import { cn } from "@/lib/cn";

/** عناصر واجهة مشتركة للوحة الإدارة (Server-safe: بدون hooks). */

export const inputClass =
  "w-full rounded-md border border-sand bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none aria-[invalid=true]:border-danger";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-charcoal px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-espresso disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-sand bg-white px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gold-text hover:bg-cream disabled:opacity-60",
} as const;

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className={buttonClass.primary}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60", className)}>
      {children}
    </section>
  );
}

const BADGE_TONES = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-cream text-espresso",
  gold: "bg-gold/15 text-gold-text",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-block rounded-sm px-2 py-0.5 text-xs font-bold", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "danger" | "success";
  href?: string;
}) {
  const valueClass = {
    neutral: "text-espresso",
    warning: "text-warning",
    danger: "text-danger",
    success: "text-success",
  }[tone];
  const content = (
    <>
      <span className="text-sm text-muted">{label}</span>
      <span className={cn("text-3xl font-extrabold", valueClass)}>
        {new Intl.NumberFormat("ar-EG").format(value)}
      </span>
    </>
  );
  const className =
    "flex flex-col gap-2 rounded-lg bg-white p-5 shadow-soft ring-1 ring-sand/60 transition-shadow";
  return href ? (
    <Link href={href} className={cn(className, "hover:shadow-lifted")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** حقل نموذج: label مربوط بالمدخل، ورسائل الخطأ مربوطة عبر aria-describedby. */
export function Field({
  id,
  label,
  hint,
  errors,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-espresso">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {errors && errors.length > 0 ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger" role="alert">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, errors?: string[], hint?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

const pageNumber = new Intl.NumberFormat("ar-EG");

/** ترقيم صفحات القوائم في الإدارة. hrefFor يبني الرابط مع الحفاظ على الفلاتر. */
export function AdminPagination({
  page,
  pageCount,
  hrefFor,
  label,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  label: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClass.secondary}>
          السابق
        </Link>
      ) : null}
      <span className="text-muted">
        الصفحة {pageNumber.format(page)} من {pageNumber.format(pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonClass.secondary}>
          التالي
        </Link>
      ) : null}
    </nav>
  );
}
