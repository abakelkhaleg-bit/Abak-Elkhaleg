import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="مسار التنقل" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-gold-text hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="text-charcoal">
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-sand">
                  ‹
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
