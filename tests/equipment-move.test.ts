import { describe, expect, it } from "vitest";
import {
  buildMoveWarnings,
  isMoveNetworkRelevant,
  isMoveUsefulAsset,
  moveRequiresConfirmation,
  MoveInputError,
  normalizeMoveInput,
  type MoveAsset,
} from "@/lib/equipment-move";
import type { InstallRange } from "@/lib/equipment-install";

const printer: MoveAsset = {
  id: "printer-1",
  name: "PACK-ZT410-01",
  category: "THERMAL_PRINTER",
  status: "ACTIVE",
  assetTag: "PRN-1",
  serialNumber: "SER-1",
  location: "Packing line 1",
  areaDepartment: "Packing",
  ipAddress: "192.168.163.45",
  macAddress: "AA:BB:CC:DD:EE:FF",
  vlan: 163,
  usesStaticIp: true,
  isFixedAsset: true,
};

const ranges: InstallRange[] = [
  { id: "packing-printers", name: "Packing Thermal Printers", category: "THERMAL_PRINTER", vlan: 163, startIp: "192.168.163.20", endIp: "192.168.163.79", location: "Packing", active: true },
  { id: "office-printers", name: "Office Printers", category: "THERMAL_PRINTER", vlan: 120, startIp: "192.168.120.20", endIp: "192.168.120.79", location: "Office", active: true },
];

describe("equipment move helpers", () => {
  it("shows move for fixed equipment and hides it for untracked mobile pool devices", () => {
    expect(isMoveUsefulAsset(printer)).toBe(true);
    expect(isMoveUsefulAsset({ category: "PHONE", location: null, areaDepartment: null, usesStaticIp: false, isFixedAsset: false, ipAddress: null, macAddress: null })).toBe(false);
    expect(isMoveUsefulAsset({ category: "PHONE", location: "IT", areaDepartment: null, usesStaticIp: false, isFixedAsset: false, ipAddress: null, macAddress: null })).toBe(true);
  });

  it("treats static/network assets as network relevant but keeps normal mobile moves placement-only", () => {
    expect(isMoveNetworkRelevant(printer)).toBe(true);
    expect(isMoveNetworkRelevant({ category: "TABLET", usesStaticIp: false, isFixedAsset: false, ipAddress: null, macAddress: null })).toBe(false);
  });

  it("requires at least one meaningful new placement field", () => {
    expect(() => normalizeMoveInput({ area: "", department: "", location: "" })).toThrow(MoveInputError);
    expect(normalizeMoveInput({ area: "Packing", department: "Outbound", location: "Line 3", keepCurrentIp: "true" })).toMatchObject({
      areaDepartment: "Packing / Outbound",
      location: "Line 3",
      keepCurrentIp: true,
    });
    expect(normalizeMoveInput({ area: "Packing", location: "Line 3", mapAnchorId: "anchor-1" })).toMatchObject({
      mapAnchorId: "anchor-1",
    });
  });

  it("warns when a network asset moves to an area with a different expected range", () => {
    const input = normalizeMoveInput({ area: "Office", location: "Office station" });
    const result = buildMoveWarnings(printer, input, [printer], ranges);
    expect(result.expectedRange?.id).toBe("office-printers");
    expect(result.warnings.map((warning) => warning.type)).toContain("RANGE_REVIEW");
    expect(result.warnings.map((warning) => warning.type)).toContain("NETWORK_REVIEW");
  });

  it("detects duplicate IP and MAC conflicts without changing the source asset", () => {
    const before = { ...printer };
    const input = normalizeMoveInput({ area: "Packing", location: "Line 3" });
    const result = buildMoveWarnings(printer, input, [
      printer,
      { ...printer, id: "printer-2", name: "Other Printer", assetTag: "PRN-2" },
    ], ranges);
    expect(result.warnings.map((warning) => warning.type)).toEqual(["DUPLICATE_IP", "DUPLICATE_MAC"]);
    expect(printer).toEqual(before);
  });

  it("requires confirmation for unusual statuses such as RMA, loaned, lost, and retired", () => {
    const input = normalizeMoveInput({ area: "Packing", location: "Line 4" });
    const result = buildMoveWarnings({ ...printer, status: "IN_REPAIR_RMA" }, input, [printer], ranges);
    expect(result.warnings[0]).toMatchObject({ type: "STATUS_REVIEW", severity: "blocking" });
    expect(moveRequiresConfirmation(result.warnings)).toBe(true);
  });

  it("warns when static equipment is missing IP or MAC but does not block placement-only updates", () => {
    const input = normalizeMoveInput({ area: "Packing", location: "Line 5" });
    const result = buildMoveWarnings({ ...printer, ipAddress: null, macAddress: null }, input, [printer], ranges);
    expect(result.warnings.map((warning) => warning.type)).toEqual(["MISSING_IP", "MISSING_MAC"]);
    expect(moveRequiresConfirmation(result.warnings)).toBe(false);
  });
});
