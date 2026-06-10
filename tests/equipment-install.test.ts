import { describe, expect, it } from "vitest";
import {
  findInstallConflicts,
  InstallInputError,
  installActionLabel,
  isInstallEligibleAsset,
  normalizeInstallInput,
  normalizeInstallMacAddress,
  suggestInstallRange,
  suggestNextIpForRange,
  type InstallAsset,
  type InstallRange,
} from "@/lib/equipment-install";

const printer: InstallAsset = {
  id: "printer-1",
  name: "Zebra Printer",
  category: "THERMAL_PRINTER",
  status: "AVAILABLE",
  assetTag: "PRN-1",
};

const mobile: InstallAsset = {
  id: "ipod-1",
  name: "iPod Touch",
  category: "PHONE",
  status: "AVAILABLE",
  assetTag: "GHT-IPO-130",
};

const ranges: InstallRange[] = [
  { id: "range-printer", name: "Packing Printers", category: "THERMAL_PRINTER", vlan: 163, startIp: "192.168.163.20", endIp: "192.168.163.22", active: true },
  { id: "range-other", name: "Other Static", category: "OTHER", vlan: 120, startIp: "192.168.120.10", endIp: "192.168.120.12", active: true },
];

describe("equipment install helpers", () => {
  it("allows fixed/network equipment but hides install for mobile pools by default", () => {
    expect(isInstallEligibleAsset(printer)).toBe(true);
    expect(isInstallEligibleAsset(mobile)).toBe(false);
    expect(isInstallEligibleAsset({ ...mobile, usesStaticIp: true })).toBe(true);
  });

  it("normalizes common MAC formats and rejects invalid values", () => {
    expect(normalizeInstallMacAddress("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizeInstallMacAddress("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizeInstallMacAddress("00:00:00:00:00:00")).toBeNull();
    expect(normalizeInstallMacAddress("FF:FF:FF:FF:FF:FF")).toBeNull();
    expect(() => normalizeInstallInput({ macAddress: "not-a-mac" })).toThrow(InstallInputError);
  });

  it("validates IP and VLAN input before saving installation details", () => {
    expect(() => normalizeInstallInput({ ipAddress: "192.168.1.500" })).toThrow(InstallInputError);
    expect(() => normalizeInstallInput({ vlan: "5000" })).toThrow(InstallInputError);
    expect(normalizeInstallInput({ ipAddress: "192.168.163.21", vlan: "163", macAddress: "AA-BB-CC-DD-EE-FF" })).toMatchObject({
      ipAddress: "192.168.163.21",
      vlan: 163,
      macAddress: "AA:BB:CC:DD:EE:FF",
    });
  });

  it("detects duplicate IP, duplicate MAC, status, and ineligible install conflicts", () => {
    const devices: InstallAsset[] = [
      printer,
      { id: "printer-2", name: "Existing Printer", category: "THERMAL_PRINTER", status: "ACTIVE", ipAddress: "192.168.163.21", macAddress: "AA:BB:CC:DD:EE:FF" },
    ];
    expect(findInstallConflicts(printer, { ipAddress: "192.168.163.21", macAddress: "aabbccddeeff" }, devices, ranges).map((conflict) => conflict.type)).toEqual(["DUPLICATE_IP", "DUPLICATE_MAC"]);
    expect(findInstallConflicts({ ...mobile, status: "LOST" }, { ipAddress: "192.168.163.21" }, devices, ranges).map((conflict) => conflict.type)).toEqual(["INELIGIBLE", "STATUS_WARNING", "DUPLICATE_IP"]);
  });

  it("flags IPs outside the selected range and suggests the next available IP", () => {
    const devices: InstallAsset[] = [
      printer,
      { id: "used-1", name: "Used 1", category: "THERMAL_PRINTER", status: "ACTIVE", ipAddress: "192.168.163.20" },
      { id: "used-2", name: "Used 2", category: "THERMAL_PRINTER", status: "ACTIVE", ipAddress: "192.168.163.22" },
    ];
    expect(findInstallConflicts(printer, { ipAddress: "192.168.120.50", ipRangeId: "range-printer" }, devices, ranges)[0]?.type).toBe("OUTSIDE_RANGE");
    expect(suggestNextIpForRange(ranges[0], devices, printer.id).ip).toBe("192.168.163.21");
  });

  it("selects a matching active range and labels installed assets as updates", () => {
    expect(suggestInstallRange(printer, ranges, "Packing")?.id).toBe("range-printer");
    expect(installActionLabel(printer)).toBe("Install / Commission");
    expect(installActionLabel({ ...printer, ipAddress: "192.168.163.21" })).toBe("Update Installation");
  });
});
