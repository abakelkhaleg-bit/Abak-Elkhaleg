"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: "لوحة التحكم", exact: true },
  { href: "/admin/orders", label: "الطلبات" },
  { href: "/admin/products", label: "المنتجات" },
  { href: "/admin/categories", label: "التصنيفات" },
  { href: "/admin/brands", label: "الماركات" },
  { href: "/admin/inventory", label: "المخزون" },
  { href: "/admin/notifications", label: "التنبيهات" },
  { href: "/admin/settings", label: "إعدادات المتجر" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="قائمة الإدارة">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-charcoal text-ivory" : "text-espresso hover:bg-cream",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
