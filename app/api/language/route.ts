import { NextRequest, NextResponse } from "next/server";
import { isSupportedLocale, localeCookieName } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const locale = payload.locale;
  if (!isSupportedLocale(locale)) {
    return NextResponse.json({ error: "Unsupported language." }, { status: 422 });
  }
  const response = NextResponse.json({ locale });
  response.cookies.set(localeCookieName, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
