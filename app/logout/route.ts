import { NextResponse, type NextRequest } from "next/server";
import { destroySession, sessionCookieName } from "@/lib/auth";
import { requestUrl } from "@/lib/public-url";

function isPrefetchRequest(request: NextRequest) {
  return request.headers.get("next-router-prefetch") === "1"
    || request.headers.get("purpose")?.toLowerCase() === "prefetch"
    || request.headers.get("sec-purpose")?.toLowerCase() === "prefetch";
}

export async function GET(request: NextRequest) {
  if (isPrefetchRequest(request)) {
    return NextResponse.redirect(requestUrl("/login", request));
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  await destroySession(token);
  const response = NextResponse.redirect(requestUrl("/login", request));
  response.cookies.delete(sessionCookieName);
  return response;
}
