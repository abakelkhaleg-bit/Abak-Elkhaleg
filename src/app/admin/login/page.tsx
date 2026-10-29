import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { safeAdminNextPath } from "@/schemas/auth";
import { getCurrentAdmin } from "@/server/auth/require-admin";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeAdminNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  if (await getCurrentAdmin()) redirect(next);

  const { logo } = siteConfig.brandAssets;
  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lifted ring-1 ring-sand/60">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src={logo.src}
            alt={siteConfig.defaultName}
            width={logo.width}
            height={logo.height}
            sizes="200px"
            className="h-14 w-auto"
            priority
          />
          <h1 className="text-xl">تسجيل دخول الإدارة</h1>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
