import { describe, expect, it } from "vitest";
import { ClientInputError } from "@/lib/api";
import {
  auditFindingTaskDetails,
  buildAuditExportRows,
  assetMatchesAuditScope,
  auditProgress,
  buildAuditDeviceWhere,
  classifyAuditScan,
  findScanMatches,
  isAuditExportType,
  normalizeAuditInput,
  scanAuditLabel,
  type AuditExportSession,
} from "@/lib/audits";
import { parseCsv, toCsv } from "@/lib/csv";

const expectedAsset = {
  id: "expected-1",
  assetTag: "GHT-LP-011",
  serialNumber: "SER-011",
  name: "DELL Latitude 5520",
  category: "LAPTOP" as const,
  location: "Packing",
  areaDepartment: "Operations",
  status: "ACTIVE" as const,
  brand: "DELL",
  model: "Latitude 5520",
  aliases: [{ aliasType: "PHYSICAL_LABEL", value: "J01" }],
};

const wrongAreaAsset = {
  id: "wrong-1",
  assetTag: "GHT-SLD-001",
  serialNumber: "SLED-001",
  name: "Infinite Peripherals Infinea X",
  category: "OTHER" as const,
  location: "Shipping",
  areaDepartment: "Operations",
  status: "ACTIVE" as const,
  brand: "Infinite Peripherals",
  model: "Infinea X",
  aliases: [{ aliasType: "SCAN_CODE", value: "K01" }],
};

describe("inventory audit helpers", () => {
  it("builds expected asset scope filters without retired/lost/RMA by default", () => {
    const input = normalizeAuditInput({ title: "Packing count", scopeType: "AREA_CATEGORY", area: "Packing", category: "LAPTOP" });
    const where = buildAuditDeviceWhere(input);

    expect(where).toMatchObject({
      category: "LAPTOP",
      status: { in: ["ACTIVE", "AVAILABLE", "RESERVED", "IN_USE_ASSIGNED"] },
    });
  });

  it("matches audit scope by location/category", () => {
    expect(assetMatchesAuditScope(expectedAsset, { area: "Packing", department: null, location: null, category: "LAPTOP" })).toBe(true);
    expect(assetMatchesAuditScope(wrongAreaAsset, { area: "Packing", department: null, location: null, category: "LAPTOP" })).toBe(false);
  });

  it("resolves physical label and scan-code aliases for audit scans", () => {
    expect(findScanMatches("J01", [expectedAsset, wrongAreaAsset]).map((device) => device.id)).toEqual(["expected-1"]);
    expect(findScanMatches("K01", [expectedAsset, wrongAreaAsset]).map((device) => device.id)).toEqual(["wrong-1"]);
  });

  it("classifies expected, wrong-area, unknown, duplicate, and alias conflict scans", () => {
    const session = { area: "Packing", department: null, location: null, category: "LAPTOP" as const };
    const expectedItems = [{ deviceId: "expected-1", resultStatus: "PENDING" as const }];

    expect(classifyAuditScan({ session, matchedDevices: [expectedAsset], expectedItems, previousScans: [] })).toMatchObject({
      resultType: "FOUND_EXPECTED",
      message: "Found expected asset.",
    });

    expect(classifyAuditScan({ session, matchedDevices: [wrongAreaAsset], expectedItems, previousScans: [] })).toMatchObject({
      resultType: "FOUND_WRONG_AREA",
    });

    expect(classifyAuditScan({ session, matchedDevices: [], expectedItems, previousScans: [] })).toMatchObject({
      resultType: "UNKNOWN_LABEL",
    });

    expect(classifyAuditScan({ session, matchedDevices: [expectedAsset], expectedItems, previousScans: [{ matchedDeviceId: "expected-1", resultType: "FOUND_EXPECTED" as const }] })).toMatchObject({
      resultType: "DUPLICATE_SCAN",
      message: "Already scanned.",
    });

    expect(classifyAuditScan({ session, matchedDevices: [expectedAsset, wrongAreaAsset], expectedItems, previousScans: [] })).toMatchObject({
      resultType: "NEEDS_REVIEW",
    });
  });

  it("computes phone audit progress counts", () => {
    const progress = auditProgress(
      [{ resultStatus: "FOUND" }, { resultStatus: "PENDING" }, { resultStatus: "MISSING" }, { resultStatus: "NEEDS_REVIEW" }],
      [{ resultType: "FOUND_EXPECTED" }, { resultType: "UNKNOWN_LABEL" }, { resultType: "DUPLICATE_SCAN" }, { resultType: "FOUND_WRONG_AREA" }],
    );

    expect(progress).toMatchObject({
      expected: 4,
      found: 1,
      remaining: 1,
      missing: 1,
      wrongArea: 1,
      unknown: 1,
      duplicates: 1,
      needsReview: 1,
    });
  });

  it("rejects empty scans before touching the database", async () => {
    await expect(scanAuditLabel("audit-1", "   ")).rejects.toBeInstanceOf(ClientInputError);
  });

  it("exports missing audit items as CSV rows", () => {
    const rows = buildAuditExportRows(exportSession(), "audit-missing");
    const csvRows = parseCsv(toCsv(rows));

    expect(csvRows).toHaveLength(1);
    expect(csvRows[0]).toMatchObject({
      auditNumber: "AUD-20260602-TEST",
      assetTag: "GHT-LP-011",
      assetName: "DELL Latitude 5520",
      expectedLocation: "Packing",
      currentLocation: "Packing",
      resultType: "MISSING",
    });
  });

  it("exports wrong-area, unknown-label, and all-finding CSV rows", () => {
    const session = exportSession();

    expect(buildAuditExportRows(session, "audit-wrong-area")).toEqual([
      expect.objectContaining({ scannedValue: "GHT-SLD-001", resultType: "FOUND_WRONG_AREA", currentLocation: "Shipping" }),
    ]);
    expect(buildAuditExportRows(session, "audit-unknown-labels")).toEqual([
      expect.objectContaining({ scannedValue: "K77", resultType: "UNKNOWN_LABEL" }),
    ]);

    const allRows = buildAuditExportRows(session, "audit-all-findings");
    expect(allRows.map((row) => row.resultType)).toEqual(["MISSING", "FOUND_WRONG_AREA", "UNKNOWN_LABEL", "DUPLICATE_SCAN", "NEEDS_REVIEW", "NEEDS_REVIEW"]);
  });

  it("exports duplicate scans with the original scan time", () => {
    const rows = buildAuditExportRows(exportSession(), "audit-duplicates");

    expect(rows).toEqual([
      expect.objectContaining({
        scannedValue: "GHT-SLD-001",
        originalScanTime: "2026-06-02T08:05:00.000Z",
      }),
    ]);
  });

  it("rejects invalid audit export types", () => {
    expect(isAuditExportType("audit-missing")).toBe(true);
    expect(isAuditExportType("audit-everything-secret")).toBe(false);
  });

  it("builds task payload details from an audit finding", () => {
    const details = auditFindingTaskDetails({
      audit: { id: "audit-1", auditNumber: "AUD-20260602-TEST", title: "Packing audit" },
      type: "unknown-label",
      scannedValue: "K77",
      expectedLocation: "Packing",
      currentLocation: "Shipping",
      timestamp: new Date("2026-06-02T08:10:00.000Z"),
    });

    expect(details.title).toBe("Audit unknown label: K77");
    expect(details.notes).toContain("Audit: AUD-20260602-TEST");
    expect(details.notes).toContain("Finding type: unknown label");
    expect(details.notes).toContain("Scanned value: K77");
    expect(details.notes).toContain("Audit link: /audits/audit-1");
  });

  it("keeps audit summary counts correct and does not mutate device data while exporting", () => {
    const session = exportSession();
    const before = JSON.stringify(session);
    const summary = buildAuditExportRows(session, "audit-summary")[0];

    expect(summary).toMatchObject({
      expectedCount: 3,
      foundCount: 1,
      missingCount: 1,
      wrongAreaCount: 1,
      unknownLabelCount: 1,
      duplicateCount: 1,
      needsReviewCount: 2,
    });
    expect(JSON.stringify(session)).toBe(before);
    expect(session.scans[0].matchedDevice?.location).toBe("Shipping");
    expect(session.scans[0].matchedDevice?.status).toBe("ACTIVE");
  });
});

function exportSession(): AuditExportSession {
  const startedAt = new Date("2026-06-02T08:00:00.000Z");
  const firstScanAt = new Date("2026-06-02T08:05:00.000Z");
  return {
    id: "audit-1",
    auditNumber: "AUD-20260602-TEST",
    title: "Packing audit",
    scopeType: "AREA_LOCATION",
    area: "Packing",
    department: null,
    location: null,
    category: null,
    status: "ACTIVE",
    startedAt,
    completedAt: null,
    expectedItems: [
      {
        id: "expected-missing",
        deviceId: "expected-1",
        expectedAssetTag: "GHT-LP-011",
        expectedDisplayName: "DELL Latitude 5520",
        expectedCategory: "LAPTOP",
        expectedLocation: "Packing",
        expectedStatus: "ACTIVE",
        resultStatus: "PENDING",
        device: {
          id: "expected-1",
          assetTag: "GHT-LP-011",
          serialNumber: "SER-011",
          name: "DELL Latitude 5520",
          category: "LAPTOP",
          location: "Packing",
          areaDepartment: "Operations",
          status: "ACTIVE",
        },
      },
      {
        id: "expected-found",
        deviceId: "expected-2",
        expectedAssetTag: "GHT-LP-012",
        expectedDisplayName: "DELL Latitude 3520",
        expectedCategory: "LAPTOP",
        expectedLocation: "Packing",
        expectedStatus: "ACTIVE",
        resultStatus: "FOUND",
        device: {
          id: "expected-2",
          assetTag: "GHT-LP-012",
          serialNumber: "SER-012",
          name: "DELL Latitude 3520",
          category: "LAPTOP",
          location: "Packing",
          areaDepartment: "Operations",
          status: "ACTIVE",
        },
      },
      {
        id: "expected-review",
        deviceId: "expected-3",
        expectedAssetTag: "GHT-LP-013",
        expectedDisplayName: "DELL Latitude 5420",
        expectedCategory: "LAPTOP",
        expectedLocation: "Packing",
        expectedStatus: "ACTIVE",
        resultStatus: "NEEDS_REVIEW",
        device: {
          id: "expected-3",
          assetTag: "GHT-LP-013",
          serialNumber: "SER-013",
          name: "DELL Latitude 5420",
          category: "LAPTOP",
          location: "Packing",
          areaDepartment: "Operations",
          status: "ACTIVE",
        },
      },
    ],
    scans: [
      {
        id: "wrong-scan",
        scannedValue: "GHT-SLD-001",
        resultType: "FOUND_WRONG_AREA",
        scannedAt: firstScanAt,
        notes: "Found real asset that belongs somewhere else.",
        matchedDeviceId: "wrong-1",
        matchedDevice: {
          id: "wrong-1",
          assetTag: "GHT-SLD-001",
          serialNumber: "SLED-001",
          name: "Infinite Peripherals Infinea X",
          category: "OTHER",
          location: "Shipping",
          areaDepartment: "Operations",
          status: "ACTIVE",
        },
      },
      {
        id: "unknown-scan",
        scannedValue: "K77",
        resultType: "UNKNOWN_LABEL",
        scannedAt: new Date("2026-06-02T08:06:00.000Z"),
        notes: "Unknown or unlinked label.",
        matchedDeviceId: null,
        matchedDevice: null,
      },
      {
        id: "duplicate-scan",
        scannedValue: "GHT-SLD-001",
        resultType: "DUPLICATE_SCAN",
        scannedAt: new Date("2026-06-02T08:07:00.000Z"),
        notes: "Already scanned.",
        matchedDeviceId: "wrong-1",
        matchedDevice: {
          id: "wrong-1",
          assetTag: "GHT-SLD-001",
          serialNumber: "SLED-001",
          name: "Infinite Peripherals Infinea X",
          category: "OTHER",
          location: "Shipping",
          areaDepartment: "Operations",
          status: "ACTIVE",
        },
      },
      {
        id: "needs-review-scan",
        scannedValue: "J01",
        resultType: "NEEDS_REVIEW",
        scannedAt: new Date("2026-06-02T08:08:00.000Z"),
        notes: "Scan matched multiple assets.",
        matchedDeviceId: null,
        matchedDevice: null,
      },
    ],
  };
}
