import { NextResponse, type NextRequest } from "next/server";
import { requestUrl } from "@/lib/public-url";

const sessionCookieName = "warehouse_session";
const publicPrefixes = ["/login", "/setup-admin", "/logout", "/api/auth", "/api/health", "/manifest.webmanifest", "/icons"];

function isPublicPath(pathname: string) {
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(sessionCookieName)?.value);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-auth-pathname", pathname);

  if (isPublicPath(pathname)) {
    if (hasSessionCookie && (pathname === "/login" || pathname === "/setup-admin")) {
      return NextResponse.redirect(requestUrl("/dashboard", request));
    }
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  if (!hasSessionCookie) {
    if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = requestUrl("/login", request);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
