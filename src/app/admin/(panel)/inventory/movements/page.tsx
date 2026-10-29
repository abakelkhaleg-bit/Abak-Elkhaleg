import type { Metadata } from "next";
import Link from "next/link";
import { AdminPagination, Card, PageHeader } from "@/components/admin/ui";
import { movementLabel } from "@/lib/labels";
import { listMovements } from "@/server/inventory.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "سجل حركات المخزون" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const arabicNumber = new Intl.NumberFormat("ar-EG");
const signed = new Intl.NumberFormat("ar-EG", { signDisplay: "exceptZero" });
const dateFormat = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" });

export default async function MovementsPage({ searchParams }: Props) {
  await requireAdminPage("/admin/inventory/movements");
  const params = await searchParams;
  const productId = first(params.product)?.match(/^[a-f0-9]{24}$/i)?.[0];
  const result = await listMovements({
    productId,
    page: Math.max(1, Number.parseInt(first(params.page) ?? "1", 10) || 1),
  });
  const productName = productId ? result.items[0]?.productName : undefined;

  const hrefFor = (page: number) => {
    const search = new URLSearchParams();
    if (productId) search.set("product", productId);
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `/admin/inventory/movements?${qs}` : "/admin/inventory/movements";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سجل حركات المخزون"
        description={
          productId
            ? `حركات ${productName ?? "المنتج"} — ${arabicNumber.format(result.total)} حركة`
            : `${arabicNumber.format(result.total)} حركة`
        }
        action={{ href: "/admin/inventory", label: "رجوع للمخزون" }}
      />
      {productId ? (
        <p className="-mt-4 text-sm">
          <Link href="/admin/inventory/movements" className="text-gold-text underline underline-offset-2">
            عرض حركات كل المنتجات
          </Link>
        </p>
      ) : null}

      <Card className="p-0">
        {result.items.length === 0 ? (
          <p className="p-8 text-center text-muted">لا توجد حركات مخزون.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">حركات المخزون من الأحدث للأقدم</caption>
              <thead className="bg-cream text-espresso">
                <tr>
                  <th scope="col" className="p-3 text-start">التاريخ</th>
                  <th scope="col" className="p-3 text-start">العطر</th>
                  <th scope="col" className="p-3 text-start">النوع</th>
                  <th scope="col" className="p-3 text-start">السابق</th>
                  <th scope="col" className="p-3 text-start">الجديد</th>
                  <th scope="col" className="p-3 text-start">الفرق</th>
                  <th scope="col" className="p-3 text-start">السبب</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((m) => (
                  <tr key={m.id} className="border-t border-sand" data-testid="movement-row">
                    <td className="whitespace-nowrap p-3 text-muted">
                      {dateFormat.format(new Date(m.createdAt))}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/inventory/movements?product=${m.productId}`}
                        className="hover:underline"
                      >
                        {m.productName}
                      </Link>{" "}
                      <span className="text-muted">({arabicNumber.format(m.sizeMl)} مل)</span>
                    </td>
                    <td className="p-3">{movementLabel(m.movementType)}</td>
                    <td className="p-3">{arabicNumber.format(m.previousQuantity)}</td>
                    <td className="p-3 font-bold">{arabicNumber.format(m.newQuantity)}</td>
                    <td
                      className={`p-3 font-bold ${m.quantityDelta < 0 ? "text-danger" : "text-success"}`}
                      dir="ltr"
                    >
                      {signed.format(m.quantityDelta)}
                    </td>
                    <td className="p-3 text-muted">{m.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdminPagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={hrefFor}
        label="صفحات سجل الحركات"
      />
    </div>
  );
}
