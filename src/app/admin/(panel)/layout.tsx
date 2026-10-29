import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { buttonClass } from "@/components/admin/ui";
import { logoutAction } from "@/features/auth/actions";
import { requireAdminPage } from "@/server/auth/require-admin";

/** صفحات الإدارة ديناميكية دائمًا (تعتمد على الجلسة)، وكل صفحة تتحقق من الجلسة بنفسها أيضًا. */
export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-sand bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lg font-extrabold text-espresso">
              لوحة إدارة عبق الخليج
            </Link>
            <Link href="/" className="text-xs text-gold-text hover:underline" target="_blank">
              عرض المتجر ↗
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              مرحبًا، <bdi className="font-bold text-charcoal">{admin.username}</bdi>
            </span>
            <form action={logoutAction}>
              <button type="submit" className={buttonClass.secondary}>
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <AdminNav />
        </aside>
        <main id="main-content" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
