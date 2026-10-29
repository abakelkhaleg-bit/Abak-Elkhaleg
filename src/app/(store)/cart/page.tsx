import type { Metadata } from "next";
import { CartView } from "@/features/cart/cart-view";
import { pageMetadata } from "@/lib/seo";
import { getPublicStoreSettings } from "@/server/settings.service";

export const metadata: Metadata = pageMetadata({
  title: "سلة المشتريات",
  path: "/cart",
  noindex: true,
});

export default async function CartPage() {
  const settings = await getPublicStoreSettings();
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl">سلة المشتريات</h1>
      <CartView whatsappAvailable={Boolean(settings.whatsappNumber)} />
    </div>
  );
}
