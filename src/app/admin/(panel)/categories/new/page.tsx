import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyForm } from "@/features/catalog/taxonomy-form";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "إضافة تصنيف" };

export default async function NewCategoryPage() {
  await requireAdminPage("/admin/categories/new");
  return (
    <div>
      <PageHeader title="إضافة تصنيف" />
      <TaxonomyForm kind="category" />
    </div>
  );
}
