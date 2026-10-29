import { NextResponse, type NextRequest } from "next/server";

/**
 * فحص مبدئي فقط لمسارات /admin: إن لم توجد كوكي جلسة أصلًا نحوّل لصفحة الدخول مبكرًا.
 * التحقق الحقيقي من الجلسة يتم في requireAdmin()/requireAdminPage() داخل كل صفحة وعملية.
 */
const SESSION_COOKIES = ["__Host-abak_session", "abak_session"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
