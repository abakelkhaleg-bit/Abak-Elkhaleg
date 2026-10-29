import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyForm } from "@/features/catalog/taxonomy-form";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "إضافة ماركة" };

export default async function NewBrandPage() {
  await requireAdminPage("/admin/brands/new");
  return (
    <div>
      <PageHeader title="إضافة ماركة" />
      <TaxonomyForm kind="brand" />
    </div>
  );
}
