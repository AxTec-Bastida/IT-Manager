import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getSessionCookieOptions, hashSessionToken, normalizeLoginIdentifier, safeUserLabel, sanitizeRedirectPath, sessionCookieName, verifyPassword } from "@/lib/auth";
import { requestUrl } from "@/lib/public-url";

function redirectWithError(request: NextRequest, message: string, nextPath?: string) {
  const url = requestUrl("/login", request);
  url.searchParams.set("error", message);
  if (nextPath) url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const identifier = normalizeLoginIdentifier(String(form.get("identifier") ?? ""));
  const password = String(form.get("password") ?? "");
  const nextPath = sanitizeRedirectPath(String(form.get("next") ?? "/dashboard"));

  if (!identifier || !password) return redirectWithError(request, "Enter your email/username and password.", nextPath);

  const user = await prisma.appUser.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return redirectWithError(request, "Invalid credentials or inactive account.", nextPath);
  }

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession(user.id);
  } catch (error) {
    return redirectWithError(request, error instanceof Error ? error.message : "Could not create login session.", nextPath);
  }
  await prisma.appUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.activityLog.create({
    data: {
      action: "auth.login",
      entity: "AppUser",
      entityId: user.id,
      message: `${safeUserLabel(user)} signed in.`,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      metadata: JSON.stringify({ sessionFingerprint: hashSessionToken(session.token).slice(0, 12) }),
    },
  });

  const response = NextResponse.redirect(requestUrl(nextPath, request), { status: 303 });
  response.cookies.set(sessionCookieName, session.token, getSessionCookieOptions(session.expiresAt, process.env, request));
  return response;
}
