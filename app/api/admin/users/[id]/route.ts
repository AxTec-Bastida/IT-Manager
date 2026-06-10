import { NextResponse, type NextRequest } from "next/server";
import { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { ClientInputError } from "@/lib/api";
import { hashPassword, makeActivityActor, requireRole, validatePasswordStrength } from "@/lib/auth";

function redirectBack(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/users", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await params;
    const form = await request.formData();
    const action = String(form.get("action") ?? "");
    const target = await prisma.appUser.findUnique({ where: { id } });
    if (!target) throw new ClientInputError("User not found.", 404);

    if (action === "role") {
      const role = String(form.get("role") ?? "") as AppRole;
      if (!Object.values(AppRole).includes(role)) return redirectBack(request, { error: "Invalid role." });
      await prisma.appUser.update({ where: { id }, data: { role } });
      await prisma.activityLog.create({ data: { action: "app_user.role_updated", entity: "AppUser", entityId: id, message: `${actor.name} changed ${target.name}'s role to ${role}.`, metadata: JSON.stringify({ previousRole: target.role, role }), ...makeActivityActor(actor) } });
      return redirectBack(request, { ok: "Role updated." });
    }

    if (action === "activate" || action === "deactivate") {
      if (target.id === actor.id && action === "deactivate") return redirectBack(request, { error: "You cannot deactivate your own account." });
      const isActive = action === "activate";
      await prisma.appUser.update({ where: { id }, data: { isActive } });
      if (!isActive) await prisma.appSession.deleteMany({ where: { userId: id } });
      await prisma.activityLog.create({ data: { action: isActive ? "app_user.activated" : "app_user.deactivated", entity: "AppUser", entityId: id, message: `${actor.name} ${isActive ? "activated" : "deactivated"} ${target.name}.`, ...makeActivityActor(actor) } });
      return redirectBack(request, { ok: isActive ? "User activated." : "User deactivated." });
    }

    if (action === "reset-password") {
      const password = String(form.get("password") ?? "");
      const passwordIssues = validatePasswordStrength(password);
      if (passwordIssues.length) return redirectBack(request, { error: `Password is too weak. ${passwordIssues.join(" ")}` });
      await prisma.appUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
      await prisma.appSession.deleteMany({ where: { userId: id } });
      await prisma.activityLog.create({ data: { action: "app_user.password_reset", entity: "AppUser", entityId: id, message: `${actor.name} reset ${target.name}'s password.`, ...makeActivityActor(actor) } });
      return redirectBack(request, { ok: "Password reset. Existing sessions were signed out." });
    }

    return redirectBack(request, { error: "Invalid user action." });
  } catch (error) {
    return handleApiError(error);
  }
}
