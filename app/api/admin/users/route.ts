import { NextResponse, type NextRequest } from "next/server";
import { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { hashPassword, makeActivityActor, requireRole, validatePasswordStrength } from "@/lib/auth";

function redirectBack(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/users", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET() {
  try {
    await requireRole("ADMIN");
    const users = await prisma.appUser.findMany({
      select: { id: true, name: true, email: true, username: true, role: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const username = String(form.get("username") ?? "").trim().toLowerCase() || null;
    const role = String(form.get("role") ?? "VIEWER") as AppRole;
    const password = String(form.get("password") ?? "");
    const passwordIssues = validatePasswordStrength(password);

    if (!name || !email) return redirectBack(request, { error: "Name and email are required." });
    if (!Object.values(AppRole).includes(role)) return redirectBack(request, { error: "Invalid role." });
    if (passwordIssues.length) return redirectBack(request, { error: `Password is too weak. ${passwordIssues.join(" ")}` });

    const user = await prisma.appUser.create({
      data: { name, email, username, role, passwordHash: await hashPassword(password) },
    });
    await prisma.activityLog.create({
      data: {
        action: "app_user.created",
        entity: "AppUser",
        entityId: user.id,
        message: `${actor.name} created app user ${user.name}.`,
        metadata: JSON.stringify({ role }),
        ...makeActivityActor(actor),
      },
    });
    return redirectBack(request, { ok: "User created." });
  } catch (error) {
    return handleApiError(error);
  }
}
