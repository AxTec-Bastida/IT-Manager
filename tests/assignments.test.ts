import { describe, expect, it } from "vitest";
import type { Device } from "@prisma/client";
import { assignmentStatusForItems, canAssignAsset, validateAssignmentAssets } from "@/lib/assignments";

function asset(status: Device["status"], overrides: Partial<Device> = {}): Device {
  return {
    id: overrides.id ?? "asset-1",
    assetTag: overrides.assetTag ?? "IT-0001",
    name: overrides.name ?? "Test Asset",
    category: overrides.category ?? "SCANNER",
    ipAddress: overrides.ipAddress ?? null,
    macAddress: null,
    vlan: null,
    location: null,
    areaDepartment: null,
    brand: null,
    model: null,
    serialNumber: null,
    status,
    condition: overrides.condition ?? "GOOD",
    assignedTo: null,
    employeeId: null,
    purchaseDate: null,
    warrantyExpiresAt: null,
    repairNotes: null,
    notes: null,
    lastSeenAt: null,
    ipRangeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("assignment validation", () => {
  it("allows available assets", () => {
    expect(canAssignAsset(asset("AVAILABLE")).ok).toBe(true);
  });

  it("blocks retired, lost, disposed, missing, loaned, and already assigned assets", () => {
    expect(canAssignAsset(asset("RETIRED")).ok).toBe(false);
    expect(canAssignAsset(asset("LOST")).ok).toBe(false);
    expect(canAssignAsset(asset("DISPOSED")).ok).toBe(false);
    expect(canAssignAsset(asset("MISSING")).ok).toBe(false);
    expect(canAssignAsset(asset("LOANED_OUT")).ok).toBe(false);
    expect(canAssignAsset(asset("IN_USE_ASSIGNED")).ok).toBe(false);
  });

  it("requires at least one selected asset", () => {
    expect(validateAssignmentAssets([]).ok).toBe(false);
  });

  it("sets assignment status from returned item state", () => {
    expect(assignmentStatusForItems([{ returnedAt: null }, { returnedAt: null }])).toBe("ACTIVE");
    expect(assignmentStatusForItems([{ returnedAt: new Date() }, { returnedAt: null }])).toBe("PARTIALLY_RETURNED");
    expect(assignmentStatusForItems([{ returnedAt: new Date() }, { returnedAt: new Date() }])).toBe("RETURNED");
  });
});
