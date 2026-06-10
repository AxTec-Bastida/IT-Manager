import type { AppRole } from "@prisma/client";
import { canPerformAction, getCurrentUser, type PermissionAction } from "@/lib/auth";

export async function hasPagePermission(action: PermissionAction) {
  const user = await getCurrentUser();
  return Boolean(user && canPerformAction(user, action));
}

export async function hasPageRole(...roles: AppRole[]) {
  const user = await getCurrentUser();
  return Boolean(user && roles.includes(user.role));
}
