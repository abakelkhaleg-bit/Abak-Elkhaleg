import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { siteConfig } from "@/config/site";
import { getAppUrl } from "@/lib/env";
import "@/styles/globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-tajawal",
});

export function generateMetadata(): Metadata {
  return {
    metadataBase: getAppUrl(),
    title: {
      default: siteConfig.defaultName,
      template: `%s | ${siteConfig.defaultName}`,
    },
    description: siteConfig.defaultDescription,
    applicationName: siteConfig.defaultName,
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.defaultName,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf6ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.language} dir={siteConfig.direction} className={tajawal.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
