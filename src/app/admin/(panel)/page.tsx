import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, StatCard } from "@/components/admin/ui";
import { movementLabel } from "@/lib/labels";
import { getDashboardStats } from "@/server/admin/dashboard.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "لوحة التحكم" };

const arabicNumber = new Intl.NumberFormat("ar-EG");
const dateFormat = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" });

export default async function DashboardPage() {
  await requireAdminPage("/admin");
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة التحكم"
        description="ملخص المنتجات والمخزون. لا تُعرض أرقام مبيعات لأن الطلبات تتم عبر واتساب."
        action={{ href: "/admin/products/new", label: "إضافة منتج" }}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="إجمالي المنتجات" value={stats.products.total} href="/admin/products" />
        <StatCard
          label="المنتجات المنشورة"
          value={stats.products.published}
          tone="success"
          href="/admin/products?status=published"
        />
        <StatCard
          label="غير المنشورة"
          value={stats.products.draft}
          href="/admin/products?status=draft"
        />
        <StatCard label="التنبيهات غير المقروءة" value={stats.unreadNotifications} tone="warning" />
        <StatCard
          label="أحجام منخفضة المخزون"
          value={stats.stock.lowVariants}
          tone="warning"
          href="/admin/products?stock=low"
        />
        <StatCard
          label="أحجام نافدة"
          value={stats.stock.outVariants}
          tone="danger"
          href="/admin/products?stock=out"
        />
        <StatCard label="المنتجات المميزة" value={stats.products.featured} />
        <StatCard label="منتجات عليها عروض" value={stats.products.onSale} />
      </div>

      <Card>
        <h2 className="mb-4 text-lg">آخر حركات المخزون</h2>
        {stats.recentMovements.length === 0 ? (
          <p className="text-sm text-muted">لا توجد حركات مخزون بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-sand text-start text-muted">
                  <th className="py-2 text-start font-medium">العطر</th>
                  <th className="py-2 text-start font-medium">الحجم</th>
                  <th className="py-2 text-start font-medium">النوع</th>
                  <th className="py-2 text-start font-medium">التغيير</th>
                  <th className="py-2 text-start font-medium">الكمية الجديدة</th>
                  <th className="py-2 text-start font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentMovements.map((movement) => (
                  <tr key={movement.id} className="border-b border-sand/60 last:border-0">
                    <td className="py-2">{movement.productName}</td>
                    <td className="py-2">{arabicNumber.format(movement.sizeMl)} مل</td>
                    <td className="py-2">{movementLabel(movement.movementType)}</td>
                    <td className="py-2" dir="ltr">
                      <bdi>
                        {movement.quantityDelta > 0 ? "+" : ""}
                        {movement.quantityDelta}
                      </bdi>
                    </td>
                    <td className="py-2">{arabicNumber.format(movement.newQuantity)}</td>
                    <td className="py-2 text-muted">{dateFormat.format(new Date(movement.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">
          تعديل المخزون وسجل الحركات الكامل والتنبيهات: تُضاف في المرحلة التالية.{" "}
          <Link href="/admin/products" className="text-gold-text underline underline-offset-2">
            إدارة المنتجات
          </Link>
        </p>
      </Card>
    </div>
  );
}
