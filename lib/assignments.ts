import type { Device } from "@prisma/client";
import { assignableStatuses } from "./constants";

export type AssignmentValidationResult = { ok: true } | { ok: false; message: string };

export function canAssignAsset(asset: Pick<Device, "status" | "name" | "assetTag">): AssignmentValidationResult {
  if (!assignableStatuses.includes(asset.status)) {
    return {
      ok: false,
      message: `${asset.assetTag || asset.name} cannot be assigned because its status is ${asset.status.replaceAll("_", " ")}.`,
    };
  }
  return { ok: true };
}

export function validateAssignmentAssets(assets: Array<Pick<Device, "id" | "status" | "name" | "assetTag">>) {
  if (assets.length === 0) return { ok: false as const, message: "Select at least one asset." };
  const blocked = assets.map(canAssignAsset).find((result) => !result.ok);
  return blocked ?? { ok: true as const };
}

export function nextAssignmentNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ASN-${date}-${random}`;
}

export function assignmentStatusForItems(items: Array<{ returnedAt: Date | null }>) {
  const returned = items.filter((item) => item.returnedAt).length;
  if (returned === 0) return "ACTIVE" as const;
  if (returned === items.length) return "RETURNED" as const;
  return "PARTIALLY_RETURNED" as const;
}
