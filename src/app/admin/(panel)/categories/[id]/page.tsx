import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyForm } from "@/features/catalog/taxonomy-form";
import { getTaxonomyForEdit } from "@/server/admin/taxonomy.admin.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "تعديل تصنيف" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/categories/${id}`);
  const item = await getTaxonomyForEdit("category", id);
  if (!item) notFound();
  return (
    <div>
      <PageHeader title={`تعديل: ${item.name}`} />
      <TaxonomyForm kind="category" item={item} />
    </div>
  );
}
