import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPagination, Badge, buttonClass, Card, inputClass, PageHeader } from "@/components/admin/ui";
import { governorateName } from "@/config/governorates";
import { cancelOrderAction, confirmOrderAction, purgeOrderPiiAction } from "@/features/orders/actions";
import { formatEGP } from "@/lib/money";
import { toWhatsAppNumber } from "@/lib/phone";
import {
  countOrdersByStatus,
  listOrders,
  ORDER_FILTERS,
  type OrderDisplayStatus,
  type OrderFilter,
} from "@/server/orders.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "الطلبات" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const arabicNumber = new Intl.NumberFormat("ar-EG");
const dateFormat = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" });

const STATUS: Record<OrderDisplayStatus, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  opened_in_whatsapp: { label: "مفتوح في واتساب", tone: "warning" },
  expired: { label: "منتهي", tone: "neutral" },
  confirmed: { label: "مؤكد", tone: "success" },
  cancelled: { label: "ملغى", tone: "danger" },
};

const FILTER_LABELS: Record<OrderFilter, string> = {
  open: "مفتوحة",
  expired: "منتهية",
  confirmed: "مؤكدة",
  cancelled: "ملغاة",
};

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireAdminPage("/admin/orders");
  const params = await searchParams;
  const filterParam = first(params.status);
  const filter = ORDER_FILTERS.find((f) => f === filterParam);
  const q = first(params.q)?.slice(0, 20) || undefined;
  const [result, counts] = await Promise.all([
    listOrders({ filter, q, page: Math.max(1, Number.parseInt(first(params.page) ?? "1", 10) || 1) }),
    countOrdersByStatus(),
  ]);

  const hrefFor = (page: number) => {
    const search = new URLSearchParams();
    if (filter) search.set("status", filter);
    if (q) search.set("q", q);
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الطلبات"
        description={`مفتوحة ${arabicNumber.format(counts.open)} · منتهية ${arabicNumber.format(counts.expired)} · مؤكدة ${arabicNumber.format(counts.confirmed)}. الطلب يُنشأ عند فتح العميل لواتساب؛ لا يُخصم المخزون إلا عند التأكيد.`}
      />

      <Card>
        <form method="get" className="flex flex-wrap gap-3" role="search">
          <label htmlFor="q" className="sr-only">
            الرقم المرجعي
          </label>
          <input
            id="q"
            name="q"
            type="search"
            dir="ltr"
            defaultValue={q ?? ""}
            placeholder="AK-000123"
            className={`${inputClass} w-40`}
          />
          <label htmlFor="status" className="sr-only">
            الحالة
          </label>
          <select id="status" name="status" defaultValue={filter ?? ""} className={`${inputClass} w-auto`}>
            <option value="">كل الحالات</option>
            {ORDER_FILTERS.map((f) => (
              <option key={f} value={f}>
                {FILTER_LABELS[f]}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass.primary}>
            تصفية
          </button>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-muted">لا توجد طلبات مطابقة.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((order) => {
            const status = STATUS[order.status];
            const canConfirm = order.status === "opened_in_whatsapp" || order.status === "expired";
            const canCancel = canConfirm || order.status === "confirmed";
            return (
              <li key={order.id} data-testid="order-row">
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <bdi className="font-extrabold text-charcoal">{order.reference}</bdi>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {order.piiPurged ? <Badge>حُذفت بيانات العميل</Badge> : null}
                    </div>
                    <span className="text-xs text-muted">{dateFormat.format(new Date(order.createdAt))}</span>
                  </div>

                  <ul className="text-sm">
                    {order.items.map((item, index) => (
                      <li key={`${item.productId}-${index}`} className="flex justify-between gap-3">
                        <span>
                          <Link href={`/admin/products/${item.productId}`} className="hover:underline">
                            {item.productName}
                          </Link>{" "}
                          <span className="text-muted">
                            ({arabicNumber.format(item.sizeMl)} مل × {arabicNumber.format(item.quantity)})
                          </span>
                        </span>
                        <span>{formatEGP(item.lineTotal)}</span>
                      </li>
                    ))}
                    <li className="mt-1 flex justify-between border-t border-sand pt-1 font-bold">
                      <span>الإجمالي</span>
                      <span>{formatEGP(order.total)}</span>
                    </li>
                  </ul>

                  {order.piiPurged ? null : (
                    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="inline text-muted">العميل: </dt>
                        <dd className="inline">{order.customer.name}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">الموبايل: </dt>
                        <dd className="inline">
                          {order.customer.phone ? (
                            <a
                              href={`https://wa.me/${toWhatsAppNumber(order.customer.phone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gold-text underline"
                              dir="ltr"
                            >
                              {order.customer.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">المحافظة: </dt>
                        <dd className="inline">
                          {order.customer.governorate ? governorateName(order.customer.governorate) : "—"}
                        </dd>
                      </div>
                      {order.customer.address ? (
                        <div className="sm:col-span-2">
                          <dt className="inline text-muted">العنوان: </dt>
                          <dd className="inline">{order.customer.address}</dd>
                        </div>
                      ) : null}
                      {order.customer.notes ? (
                        <div className="sm:col-span-2">
                          <dt className="inline text-muted">ملاحظات: </dt>
                          <dd className="inline">{order.customer.notes}</dd>
                        </div>
                      ) : null}
                    </dl>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {canConfirm ? (
                      <ActionButton
                        action={confirmOrderAction.bind(null, order.id)}
                        label="تأكيد الطلب"
                        variant="primary"
                        confirmText={`سيُخصم مخزون بنود الطلب ${order.reference}. تابع فقط بعد الاتفاق مع العميل.`}
                        successMessage="أُكد الطلب وخُصم المخزون."
                      />
                    ) : null}
                    {canCancel ? (
                      <ActionButton
                        action={cancelOrderAction.bind(null, order.id)}
                        label="إلغاء"
                        variant="danger"
                        confirmText={
                          order.status === "confirmed"
                            ? `سيُلغى الطلب ${order.reference} ويُعاد مخزونه.`
                            : `سيُلغى الطلب ${order.reference}.`
                        }
                        successMessage="أُلغي الطلب."
                      />
                    ) : null}
                    {order.piiPurged ? null : (
                      <ActionButton
                        action={purgeOrderPiiAction.bind(null, order.id)}
                        label="حذف بيانات العميل"
                        confirmText="سيُحذف الاسم والموبايل والعنوان والملاحظات نهائيًا. البنود والإجمالي يبقيان."
                        successMessage="حُذفت بيانات العميل."
                      />
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AdminPagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} label="صفحات الطلبات" />
    </div>
  );
}
