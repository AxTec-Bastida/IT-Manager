import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getAuthSecretStatus, getSessionCookieOptions, hashPassword, sessionCookieName, validatePasswordStrength } from "@/lib/auth";

function setupError(request: NextRequest, message: string) {
  const url = new URL("/setup-admin", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  const existingUsers = await prisma.appUser.count();
  if (existingUsers > 0) return NextResponse.redirect(new URL("/login", request.url));

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const username = String(form.get("username") ?? "").trim().toLowerCase() || null;
  const password = String(form.get("password") ?? "");
  const passwordIssues = validatePasswordStrength(password);
  const authSecret = getAuthSecretStatus();

  if (!name || !email) return setupError(request, "Name and email are required.");
  if (passwordIssues.length) return setupError(request, `Password is too weak. ${passwordIssues.join(" ")}`);
  if (!authSecret.usable) return setupError(request, "SESSION_SECRET or AUTH_SECRET must be configured before creating the first admin.");

  const user = await prisma.appUser.create({
    data: {
      name,
      email,
      username,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession(user.id);
  } catch (error) {
    return setupError(request, error instanceof Error ? error.message : "Could not create login session.");
  }
  await prisma.activityLog.create({
    data: {
      action: "auth.setup_admin",
      entity: "AppUser",
      entityId: user.id,
      message: `${user.name} created the first administrator account.`,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
    },
  });

  const response = NextResponse.redirect(new URL("/admin/users", request.url));
  response.cookies.set(sessionCookieName, session.token, getSessionCookieOptions(session.expiresAt));
  return response;
}
