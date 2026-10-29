import Link from "next/link";

export function SectionHeading({
  id,
  title,
  subtitle,
  link,
}: {
  id: string;
  title: string;
  subtitle?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-2xl sm:text-3xl">
          {title}
        </h2>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {link ? (
        <Link href={link.href} className="text-sm font-medium text-gold-text hover:underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}
