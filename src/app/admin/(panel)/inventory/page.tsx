import type { Metadata } from "next";
import Link from "next/link";
import { AdminPagination, Badge, buttonClass, Card, inputClass, PageHeader } from "@/components/admin/ui";
import { StockControls } from "@/features/inventory/stock-controls";
import { listInventory } from "@/server/inventory.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "المخزون" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const arabicNumber = new Intl.NumberFormat("ar-EG");

const STATUS = {
  ok: { tone: "success", label: "متوفر" },
  low: { tone: "warning", label: "منخفض" },
  out: { tone: "danger", label: "نافد" },
  unavailable: { tone: "neutral", label: "غير معروض" },
} as const;

export default async function AdminInventoryPage({ searchParams }: Props) {
  await requireAdminPage("/admin/inventory");
  const params = await searchParams;
  const filterParam = first(params.filter);
  const filter = filterParam === "low" || filterParam === "out" ? filterParam : undefined;
  const q = first(params.q)?.slice(0, 64) || undefined;
  const result = await listInventory({
    q,
    filter,
    page: Math.max(1, Number.parseInt(first(params.page) ?? "1", 10) || 1),
  });

  const hrefFor = (page: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (filter) search.set("filter", filter);
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المخزون"
        description={`${arabicNumber.format(result.total)} حجم. كل تعديل يُسجَّل في سجل الحركات.`}
        action={{ href: "/admin/inventory/movements", label: "سجل الحركات" }}
      />

      <Card>
        <form method="get" className="flex flex-wrap gap-3" role="search">
          <label htmlFor="q" className="sr-only">
            بحث
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="ابحث بالاسم أو SKU"
            className={`${inputClass} min-w-48 flex-1`}
          />
          <label htmlFor="filter" className="sr-only">
            حالة المخزون
          </label>
          <select id="filter" name="filter" defaultValue={filter ?? ""} className={`${inputClass} w-auto`}>
            <option value="">كل الأحجام</option>
            <option value="low">منخفض</option>
            <option value="out">نافد</option>
          </select>
          <button type="submit" className={buttonClass.primary}>
            تصفية
          </button>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-muted">لا توجد أحجام مطابقة.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((row) => {
            const status = STATUS[row.status];
            const label = `${row.productName} — ${arabicNumber.format(row.sizeMl)} مل`;
            return (
              <li key={row.variantId} data-testid="inventory-row">
                <Card className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/products/${row.productId}`}
                          className="font-bold text-charcoal hover:underline"
                        >
                          {row.productName}
                        </Link>
                        <span className="text-sm text-espresso">
                          {arabicNumber.format(row.sizeMl)} مل
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {row.isPublished ? null : <Badge>غير منشور</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {row.sku ? <bdi>{row.sku}</bdi> : "بدون SKU"} · حد التنبيه{" "}
                        {arabicNumber.format(row.lowStockThreshold)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-extrabold text-charcoal" data-testid="stock-quantity">
                        {arabicNumber.format(row.stockQuantity)}
                      </p>
                      <Link
                        href={`/admin/inventory/movements?product=${row.productId}`}
                        className="text-sm text-gold-text underline underline-offset-2"
                      >
                        السجل
                      </Link>
                    </div>
                  </div>
                  <StockControls
                    productId={row.productId}
                    variantId={row.variantId}
                    label={label}
                    stockQuantity={row.stockQuantity}
                    lowStockThreshold={row.lowStockThreshold}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AdminPagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={hrefFor}
        label="صفحات المخزون"
      />
    </div>
  );
}
