import type { Metadata } from "next";
import { TaxonomyList } from "@/features/catalog/taxonomy-list";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "الماركات" };

export default async function AdminBrandsPage() {
  await requireAdminPage("/admin/brands");
  return <TaxonomyList kind="brand" />;
}
