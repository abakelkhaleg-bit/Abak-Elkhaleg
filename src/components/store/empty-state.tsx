import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sand bg-white/60 px-6 py-14 text-center">
      <span aria-hidden="true" className="text-3xl text-gold">
        ✦
      </span>
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="max-w-md text-sm leading-7 text-muted">{description}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-2 rounded-md bg-charcoal px-5 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-espresso"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
