import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPagination, Badge, Card, PageHeader } from "@/components/admin/ui";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/inventory/actions";
import { listNotifications } from "@/server/notifications.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "التنبيهات" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const arabicNumber = new Intl.NumberFormat("ar-EG");
const dateFormat = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" });

export default async function NotificationsPage({ searchParams }: Props) {
  await requireAdminPage("/admin/notifications");
  const params = await searchParams;
  const showAll = first(params.show) === "all";
  const result = await listNotifications({
    onlyOpen: !showAll,
    page: Math.max(1, Number.parseInt(first(params.page) ?? "1", 10) || 1),
  });
  const hasUnread = result.items.some((n) => n.status === "unread");

  const hrefFor = (page: number) => {
    const search = new URLSearchParams();
    if (showAll) search.set("show", "all");
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `/admin/notifications?${qs}` : "/admin/notifications";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="التنبيهات"
        description={
          showAll
            ? `${arabicNumber.format(result.total)} تنبيه (الكل، بما فيها المحلولة)`
            : `${arabicNumber.format(result.total)} تنبيه مفتوح. يُغلق التنبيه تلقائيًا عند تجديد المخزون.`
        }
      />
      <div className="-mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={showAll ? "/admin/notifications" : "/admin/notifications?show=all"}
          className="text-gold-text underline underline-offset-2"
        >
          {showAll ? "عرض المفتوحة فقط" : "عرض كل التنبيهات"}
        </Link>
        {hasUnread ? (
          <ActionButton
            action={markAllNotificationsReadAction}
            label="تعليم الكل كمقروء"
            successMessage="عُلّمت كل التنبيهات كمقروءة."
          />
        ) : null}
      </div>

      {result.items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-muted">لا توجد تنبيهات. المخزون في حالة جيدة.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((n) => (
            <li key={n.id} data-testid="notification-row">
              <Card
                className={`flex flex-wrap items-center gap-3 p-4 ${n.status === "unread" ? "ring-gold" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={n.type === "out_of_stock" ? "danger" : "warning"}>
                      {n.type === "out_of_stock" ? "نفد المخزون" : "مخزون منخفض"}
                    </Badge>
                    {n.status === "unread" ? <Badge tone="gold">غير مقروء</Badge> : null}
                    {n.isOpen ? null : <Badge tone="success">حُل</Badge>}
                  </div>
                  <p className="mt-1 font-medium text-charcoal">{n.message}</p>
                  <p className="mt-1 text-xs text-muted">
                    {dateFormat.format(new Date(n.createdAt))}
                    {n.resolvedAt ? ` · حُل في ${dateFormat.format(new Date(n.resolvedAt))}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/products/${n.productId}`}
                    className="text-sm text-gold-text underline underline-offset-2"
                  >
                    تعديل المنتج
                  </Link>
                  {n.status === "unread" ? (
                    <ActionButton
                      action={markNotificationReadAction.bind(null, n.id)}
                      label="تعليم كمقروء"
                      successMessage="عُلّم التنبيه كمقروء."
                    />
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AdminPagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={hrefFor}
        label="صفحات التنبيهات"
      />
    </div>
  );
}
