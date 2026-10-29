import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/features/catalog/product-form";
import { getProductForEdit } from "@/server/admin/products.admin.service";
import { listTaxonomyForAdmin } from "@/server/admin/taxonomy.admin.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "تعديل منتج" };

type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  await requireAdminPage(`/admin/products/${id}`);
  const [product, categories, brands] = await Promise.all([
    getProductForEdit(id),
    listTaxonomyForAdmin("category"),
    listTaxonomyForAdmin("brand"),
  ]);
  if (!product) notFound();

  return (
    <div>
      <PageHeader title={`تعديل: ${product.name}`} />
      <ProductForm
        product={product}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
