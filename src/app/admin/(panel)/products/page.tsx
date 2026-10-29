import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, buttonClass, Card, inputClass, PageHeader } from "@/components/admin/ui";
import { siteConfig } from "@/config/site";
import {
  deleteProductAction,
  setProductFeaturedAction,
  setProductPublishedAction,
} from "@/features/catalog/actions";
import { formatEGP } from "@/lib/money";
import { listProductsForAdmin, type AdminProductQuery } from "@/server/admin/products.admin.service";
import { listTaxonomyForAdmin } from "@/server/admin/taxonomy.admin.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "المنتجات" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const arabicNumber = new Intl.NumberFormat("ar-EG");

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireAdminPage("/admin/products");
  const params = await searchParams;
  const status = first(params.status);
  const stock = first(params.stock);
  const query: AdminProductQuery = {
    q: first(params.q)?.slice(0, 64) || undefined,
    categoryId: first(params.category) || undefined,
    brandId: first(params.brand) || undefined,
    status: status === "published" || status === "draft" ? status : undefined,
    stock: stock === "out" || stock === "low" ? stock : undefined,
    page: Math.max(1, Number.parseInt(first(params.page) ?? "1", 10) || 1),
  };

  const [result, categories, brands] = await Promise.all([
    listProductsForAdmin(query),
    listTaxonomyForAdmin("category"),
    listTaxonomyForAdmin("brand"),
  ]);

  const pageHref = (page: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const v = first(value);
      if (v && key !== "page") search.set(key, v);
    }
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المنتجات"
        description={`${arabicNumber.format(result.total)} منتج`}
        action={{ href: "/admin/products/new", label: "إضافة منتج" }}
      />

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
          <div className="lg:col-span-2">
            <label htmlFor="q" className="sr-only">
              بحث
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q ?? ""}
              placeholder="ابحث بالاسم أو SKU أو الرابط"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="category" className="sr-only">
              التصنيف
            </label>
            <select
              id="category"
              name="category"
              defaultValue={query.categoryId ?? ""}
              className={inputClass}
            >
              <option value="">كل التصنيفات</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="brand" className="sr-only">
              الماركة
            </label>
            <select id="brand" name="brand" defaultValue={query.brandId ?? ""} className={inputClass}>
              <option value="">كل الماركات</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="sr-only">
              حالة النشر
            </label>
            <select id="status" name="status" defaultValue={query.status ?? ""} className={inputClass}>
              <option value="">كل الحالات</option>
              <option value="published">منشور</option>
              <option value="draft">غير منشور</option>
            </select>
          </div>
          <div className="flex gap-2">
            <label htmlFor="stock" className="sr-only">
              المخزون
            </label>
            <select id="stock" name="stock" defaultValue={query.stock ?? ""} className={inputClass}>
              <option value="">كل المخزون</option>
              <option value="low">منخفض</option>
              <option value="out">نافد</option>
            </select>
            <button type="submit" className={buttonClass.primary}>
              تصفية
            </button>
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-muted">
            لا توجد منتجات مطابقة.{" "}
            <Link href="/admin/products/new" className="text-gold-text underline underline-offset-2">
              أضف منتجًا
            </Link>
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((product) => (
            <li key={product.id} data-testid="admin-product-row">
              <Card className="flex flex-wrap items-center gap-4 p-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-cream">
                  <Image
                    src={product.image ?? siteConfig.brandAssets.placeholder}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-bold text-charcoal hover:underline"
                    >
                      {product.name}
                    </Link>
                    {product.isPublished ? (
                      <Badge tone="success">منشور</Badge>
                    ) : (
                      <Badge>غير منشور</Badge>
                    )}
                    {product.isFeatured ? <Badge tone="gold">مميز</Badge> : null}
                    {product.isOnSale ? <Badge tone="danger">عرض</Badge> : null}
                    {product.hasOutOfStock ? <Badge tone="danger">حجم نافد</Badge> : null}
                    {product.hasLowStock ? <Badge tone="warning">مخزون منخفض</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {product.brandName ?? "—"} · {product.categoryName ?? "—"} ·{" "}
                    {arabicNumber.format(product.variantCount)} حجم · المخزون{" "}
                    {arabicNumber.format(product.totalStock)} · ترتيب{" "}
                    {arabicNumber.format(product.sortOrder)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-espresso">
                    {product.minPrice === product.maxPrice
                      ? formatEGP(product.minPrice)
                      : `${formatEGP(product.minPrice)} – ${formatEGP(product.maxPrice)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/products/${product.id}`} className={buttonClass.secondary}>
                    تعديل
                  </Link>
                  <ActionButton
                    action={setProductPublishedAction.bind(null, product.id, !product.isPublished)}
                    label={product.isPublished ? "إيقاف النشر" : "نشر"}
                    successMessage={product.isPublished ? "أُوقف نشر المنتج." : "نُشر المنتج."}
                  />
                  <ActionButton
                    action={setProductFeaturedAction.bind(null, product.id, !product.isFeatured)}
                    label={product.isFeatured ? "إلغاء التمييز" : "تمييز"}
                    successMessage={
                      product.isFeatured ? "أُلغي تمييز المنتج." : "أصبح المنتج مميزًا."
                    }
                  />
                  <ActionButton
                    action={deleteProductAction.bind(null, product.id)}
                    label="حذف"
                    variant="danger"
                    confirmText={`سيُحذف «${product.name}» نهائيًا. سجل حركات المخزون والطلبات السابقة يبقى. بديل أكثر أمانًا: إيقاف النشر.`}
                    successMessage="حُذف المنتج."
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="صفحات المنتجات" className="flex items-center justify-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className={buttonClass.secondary}>
              السابق
            </Link>
          ) : null}
          <span className="text-muted">
            الصفحة {arabicNumber.format(result.page)} من {arabicNumber.format(result.pageCount)}
          </span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} className={buttonClass.secondary}>
              التالي
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
