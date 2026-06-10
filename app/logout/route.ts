import { NextResponse, type NextRequest } from "next/server";
import { destroySession, sessionCookieName } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  await destroySession(token);
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(sessionCookieName);
  return response;
}
