import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { suggestQuerySchema } from "@/schemas/catalog";
import { searchSuggestions } from "@/server/catalog.service";

export const dynamic = "force-dynamic";

/** اقتراحات البحث (للقراءة فقط). المدخل يُتحقق منه ويُهرَّب قبل بناء الاستعلام. */
export async function GET(request: NextRequest) {
  const parsed = suggestQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const suggestions = await searchSuggestions(parsed.data.q);
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (error) {
    logger.error("فشل اقتراحات البحث", { error });
    return NextResponse.json({ suggestions: [] }, { status: 503 });
  }
}
