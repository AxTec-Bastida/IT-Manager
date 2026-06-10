import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDecommissionBlockers,
  buildDecommissionWarnings,
  canRoleUseDecommissionReason,
  defaultDecommissionChecklist,
  finalStatusForDecommissionReason,
  normalizeChecklistState,
  validateDecommissionRequest,
} from "@/lib/decommission";

const projectRoot = process.cwd();

const baseDevice = {
  id: "asset-1",
  name: "QA Laptop",
  category: "LAPTOP" as const,
  status: "ACTIVE" as const,
  ipAddress: null,
  macAddress: null,
  usesStaticIp: false,
  isFixedAsset: false,
  currentMapAnchorId: null,
  photos: [{ id: "photo-1", photoType: "OVERVIEW" }],
  assignmentItems: [],
  assetLoanItems: [],
  rmaItems: [],
  tasks: [],
  sourceRelationships: [],
  targetRelationships: [],
  auditExpectedItems: [],
  auditScans: [],
};

describe("decommission workflow rules", () => {
  it("maps reasons to safe existing asset statuses", () => {
    expect(finalStatusForDecommissionReason("RETIRED")).toBe("RETIRED");
    expect(finalStatusForDecommissionReason("RECYCLED")).toBe("RETIRED");
    expect(finalStatusForDecommissionReason("DISPOSED")).toBe("DISPOSED");
    expect(finalStatusForDecommissionReason("LOST")).toBe("LOST");
    expect(finalStatusForDecommissionReason("STOLEN")).toBe("LOST");
    expect(finalStatusForDecommissionReason("RETURNED_TO_VENDOR")).toBe("RETIRED");
  });

  it("requires notes for sensitive disposal/loss reasons", () => {
    expect(validateDecommissionRequest({ role: "ADMIN", reason: "LOST", notes: "" })).toContain("Lost requires notes.");
    expect(validateDecommissionRequest({ role: "ADMIN", reason: "STOLEN", notes: null })).toContain("Stolen requires notes.");
    expect(validateDecommissionRequest({ role: "ADMIN", reason: "DISPOSED", notes: "" })).toContain("Disposed requires notes.");
    expect(validateDecommissionRequest({ role: "ADMIN", reason: "DESTROYED", notes: "" })).toContain("Destroyed requires notes.");
    expect(validateDecommissionRequest({ role: "ADMIN", reason: "RETIRED", notes: "" })).toEqual([]);
  });

  it("limits lost, stolen, and destroyed reasons to Admin", () => {
    expect(canRoleUseDecommissionReason("ADMIN", "STOLEN")).toBe(true);
    expect(canRoleUseDecommissionReason("IT_STAFF", "RETIRED")).toBe(true);
    expect(canRoleUseDecommissionReason("IT_STAFF", "DISPOSED")).toBe(true);
    expect(canRoleUseDecommissionReason("IT_STAFF", "LOST")).toBe(false);
    expect(canRoleUseDecommissionReason("IT_STAFF", "DESTROYED")).toBe(false);
    expect(canRoleUseDecommissionReason("AUDITOR", "RETIRED")).toBe(false);
    expect(canRoleUseDecommissionReason("VIEWER", "RETIRED")).toBe(false);
  });

  it("blocks active assignment, asset loan, and RMA records", () => {
    const blockers = buildDecommissionBlockers({
      ...baseDevice,
      assignmentItems: [{ id: "ai-1", assignmentId: "asg-1", assignment: { assignmentNumber: "A-1" } }],
      assetLoanItems: [{ id: "li-1", loanId: "loan-1", loan: { loanNumber: "L-1" } }],
      rmaItems: [{ id: "ri-1", rmaCaseId: "rma-1", rmaCase: { rmaNumber: "RMA-1" } }],
    });

    expect(blockers.map((blocker) => blocker.type)).toEqual(["ACTIVE_ASSIGNMENT", "ACTIVE_LOAN", "ACTIVE_RMA"]);
    expect(validateDecommissionRequest({ role: "ADMIN", reason: "RETIRED", notes: "ok", blockers })).toContain("Close active assignment, loan, or RMA records before decommissioning this asset.");
  });

  it("warns without blocking for open tasks, missing photos, pairings, network data, map location, and audit findings", () => {
    const warnings = buildDecommissionWarnings({
      ...baseDevice,
      photos: [],
      ipAddress: "192.168.1.10",
      currentMapAnchorId: "map-location-1",
      tasks: [{ id: "task-1", title: "Review", status: "OPEN" }],
      sourceRelationships: [{ id: "rel-1", status: "ACTIVE", targetDevice: { name: "Sled", assetTag: "GHT-SLD-1" } }],
      auditExpectedItems: [{ id: "audit-1", resultStatus: "MISSING", auditSession: { title: "Audit", auditNumber: "A-1" } }],
    });

    expect(warnings.map((warning) => warning.type)).toEqual(["OPEN_TASKS", "MISSING_PHOTOS", "PAIRED_ASSET", "STATIC_NETWORK_DATA", "MAP_LOCATION", "RECENT_AUDIT"]);
  });

  it("uses category-specific security checklist items and stores only known checkbox keys", () => {
    const laptopChecklist = defaultDecommissionChecklist("LAPTOP");
    expect(laptopChecklist.map((item) => item.id)).toContain("local_data_wiped");
    expect(laptopChecklist.map((item) => item.id)).toContain("bitlocker_reviewed");

    const scaleChecklist = defaultDecommissionChecklist("SCALE");
    expect(scaleChecklist.map((item) => item.id)).toContain("configuration_reset");
    expect(scaleChecklist.map((item) => item.id)).toContain("network_marked_inactive");

    expect(normalizeChecklistState({ local_data_wiped: "on", unknown: "on" }, laptopChecklist)).toEqual({ local_data_wiped: true });
  });
});

describe("decommission source contracts", () => {
  it("API route creates audit record, updates device status, logs activity, and checks blockers", () => {
    const routeSource = readFileSync(path.join(projectRoot, "app", "api", "devices", "[id]", "decommission", "route.ts"), "utf8");

    expect(routeSource).toContain('requirePermission("inventory.write")');
    expect(routeSource).toContain("assignmentItems");
    expect(routeSource).toContain("assetLoanItems");
    expect(routeSource).toContain("rmaItems");
    expect(routeSource).toContain("assetDecommissionRecord.create");
    expect(routeSource).toContain("device.update");
    expect(routeSource).toContain("activityLog.create");
  });

  it("asset detail and Quick Scan expose decommission warnings/actions", () => {
    const detailSource = readFileSync(path.join(projectRoot, "app", "devices", "[id]", "page.tsx"), "utf8");
    const scanSource = readFileSync(path.join(projectRoot, "components", "quick-scan-panel.tsx"), "utf8");

    expect(detailSource).toContain("Decommission");
    expect(detailSource).toContain("Decommission record");
    expect(detailSource).not.toContain("<RetireButton");
    expect(scanSource).toContain("This asset is retired/decommissioned.");
    expect(scanSource).toContain("/decommission");
  });
});
