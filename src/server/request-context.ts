import "server-only";
import { headers } from "next/headers";
import { getTrustedProxyHeader } from "@/lib/env";

/**
 * معلومات الطلب الحالي (IP وUser-Agent). الـIP يُقرأ فقط من الرأس الذي يضبطه
 * الوكيل الموثوق (docs/SECURITY.md §3)، ولا يُخزن نصًا أبدًا.
 */
export async function getRequestContext(): Promise<{ ip: string; userAgent: string | null }> {
  const store = await headers();
  const header = getTrustedProxyHeader();
  const raw = store.get(header) ?? "";
  const ip = (header === "x-forwarded-for" ? raw.split(",")[0] : raw)?.trim() || "unknown";
  return { ip, userAgent: store.get("user-agent") };
}
