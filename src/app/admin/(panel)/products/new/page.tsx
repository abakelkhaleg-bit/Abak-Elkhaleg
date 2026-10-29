import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/features/catalog/product-form";
import { listTaxonomyForAdmin } from "@/server/admin/taxonomy.admin.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "إضافة منتج" };

export default async function NewProductPage() {
  await requireAdminPage("/admin/products/new");
  const [categories, brands] = await Promise.all([
    listTaxonomyForAdmin("category"),
    listTaxonomyForAdmin("brand"),
  ]);
  return (
    <div>
      <PageHeader title="إضافة منتج" />
      {categories.length === 0 || brands.length === 0 ? (
        <p className="mb-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
          أضف تصنيفًا وماركة واحدة على الأقل قبل إضافة المنتجات.
        </p>
      ) : null}
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
