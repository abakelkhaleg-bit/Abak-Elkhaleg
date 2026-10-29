import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkDatabaseHealth();
  const healthy = health.db === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "error", ...health },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
