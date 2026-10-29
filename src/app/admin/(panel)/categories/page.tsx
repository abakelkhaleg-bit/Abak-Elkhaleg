import type { Metadata } from "next";
import { TaxonomyList } from "@/features/catalog/taxonomy-list";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "التصنيفات" };

export default async function AdminCategoriesPage() {
  await requireAdminPage("/admin/categories");
  return <TaxonomyList kind="category" />;
}
