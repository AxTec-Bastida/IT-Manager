import { describe, expect, it } from "vitest";
import type { Device, IpRange } from "@prisma/client";
import { detectInventoryConflicts } from "@/lib/conflicts";

const baseRange: IpRange = {
  id: "range-1",
  name: "Printers",
  category: "THERMAL_PRINTER",
  vlan: 163,
  subnet: "192.168.163.0/24",
  startIp: "192.168.163.20",
  endIp: "192.168.163.30",
  location: "Pack",
  notes: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function device(overrides: Partial<Device>): Device & { ipRange: IpRange | null } {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Device",
    category: overrides.category ?? "THERMAL_PRINTER",
    ipAddress: overrides.ipAddress ?? "192.168.163.20",
    macAddress: overrides.macAddress ?? "00:11:22:33:44:55",
    vlan: overrides.vlan ?? 163,
    location: null,
    brand: null,
    model: null,
    serialNumber: null,
    status: overrides.status ?? "ACTIVE",
    assignedTo: null,
    notes: null,
    lastSeenAt: null,
    ipRangeId: "range-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ipRange: baseRange,
  };
}

describe("conflict detection", () => {
  it("detects duplicate active/reserved IPs", () => {
    const conflicts = detectInventoryConflicts([
      device({ id: "a", name: "A", ipAddress: "192.168.163.20" }),
      device({ id: "b", name: "B", ipAddress: "192.168.163.20", status: "RESERVED" }),
    ]);

    expect(conflicts.some((conflict) => conflict.type === "DUPLICATE_IP")).toBe(true);
  });

  it("detects duplicate active MACs", () => {
    const conflicts = detectInventoryConflicts([
      device({ id: "a", name: "A", macAddress: "00:11:22:33:44:55", ipAddress: "192.168.163.20" }),
      device({ id: "b", name: "B", macAddress: "001122334455", ipAddress: "192.168.163.21" }),
    ]);

    expect(conflicts.some((conflict) => conflict.type === "DUPLICATE_MAC")).toBe(true);
  });

  it("detects outside-range and VLAN mismatch issues", () => {
    const conflicts = detectInventoryConflicts([device({ id: "a", name: "A", ipAddress: "192.168.163.80", vlan: 164 })]);
    expect(conflicts.some((conflict) => conflict.type === "OUTSIDE_RANGE")).toBe(true);
    expect(conflicts.some((conflict) => conflict.type === "VLAN_MISMATCH")).toBe(true);
  });
});
