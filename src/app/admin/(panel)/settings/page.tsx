import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/features/settings/settings-form";
import { getSettingsForEdit } from "@/server/admin/settings.admin.service";
import { requireAdminPage } from "@/server/auth/require-admin";

export const metadata: Metadata = { title: "إعدادات المتجر" };

export default async function AdminSettingsPage() {
  await requireAdminPage("/admin/settings");
  const settings = await getSettingsForEdit();
  return (
    <div>
      <PageHeader
        title="إعدادات المتجر"
        description="الشعار وصورة المشاركة وصورة الـHero تُرفع عبر مدير الصور في المرحلة التالية."
      />
      <SettingsForm initial={settings} />
    </div>
  );
}
