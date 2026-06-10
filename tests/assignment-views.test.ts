import { describe, expect, it } from "vitest";
import {
  getActiveAssignmentItems,
  getAssignmentReviewReasons,
  groupActiveAssignmentsByEmployee,
  isActiveAssignment,
  isHistoricalAssignment,
  matchesAssignmentSearch,
  assignmentResponsibleLabel,
} from "@/lib/assignment-views";

const activeAssignment = {
  id: "assignment-1",
  assignmentNumber: "ASN-001",
  status: "ACTIVE",
  signatureData: "signature",
  assignmentDate: new Date("2026-04-30"),
  employee: { id: "employee-1", fullName: "Luis Rodriguez", employeeId: "E100", department: "Packing" },
  items: [
    {
      id: "item-1",
      returnStatus: "NOT_RETURNED",
      returnedAt: null,
      asset: { id: "asset-1", name: "DELL Latitude 5520", assetTag: "GHT-LP-11", serialNumber: "GLF54B3", model: "Latitude 5520", location: "Packing", status: "IN_USE_ASSIGNED", employeeId: "employee-1" },
    },
  ],
};

const returnedAssignment = {
  id: "assignment-2",
  assignmentNumber: "ASN-002",
  status: "RETURNED",
  signatureData: "signature",
  assignmentDate: new Date("2026-03-01"),
  employee: { id: "employee-2", fullName: "Ana Lopez", employeeId: "E200", department: "Receiving" },
  items: [
    {
      id: "item-2",
      returnStatus: "RETURNED",
      returnedAt: new Date("2026-03-05"),
      asset: { id: "asset-2", name: "Monitor", assetTag: "GHT-MO-71", serialNumber: "MON-1", model: "E2425HSM", location: "Receiving", status: "AVAILABLE", employeeId: null },
    },
  ],
};

describe("assignment view helpers", () => {
  it("treats assignments with active items as current equipment responsibility", () => {
    expect(isActiveAssignment(activeAssignment)).toBe(true);
    expect(getActiveAssignmentItems(activeAssignment)).toHaveLength(1);
  });

  it("keeps returned assignments in history instead of the active default view", () => {
    expect(isActiveAssignment(returnedAssignment)).toBe(false);
    expect(isHistoricalAssignment(returnedAssignment)).toBe(true);
  });

  it("groups active assignments by responsibility target for the by-target view", () => {
    const groups = groupActiveAssignmentsByEmployee([activeAssignment, returnedAssignment]);
    expect(groups).toHaveLength(1);
    expect(groups[0].employee.fullName).toBe("Luis Rodriguez");
    expect(groups[0].responsibleLabel).toBe("Luis Rodriguez");
    expect(groups[0].activeItems).toHaveLength(1);
  });

  it("supports department or area responsibility targets without an employee", () => {
    const teamAssignment = {
      ...activeAssignment,
      employee: null,
      targetType: "AREA",
      targetName: "Pack",
      targetPath: "Ops > Fabletics > Pack",
      items: [{ ...activeAssignment.items[0], asset: { ...activeAssignment.items[0].asset, employeeId: null, assignedTo: "Ops > Fabletics > Pack" } }],
    };
    const groups = groupActiveAssignmentsByEmployee([teamAssignment]);
    expect(assignmentResponsibleLabel(teamAssignment)).toBe("Ops > Fabletics > Pack");
    expect(groups[0].responsibleLabel).toBe("Ops > Fabletics > Pack");
    expect(matchesAssignmentSearch(teamAssignment, "Fabletics")).toBe(true);
  });

  it("searches employees, assignment numbers, and asset identifiers", () => {
    expect(matchesAssignmentSearch(activeAssignment, "GHT-LP-11")).toBe(true);
    expect(matchesAssignmentSearch(activeAssignment, "Packing")).toBe(true);
    expect(matchesAssignmentSearch(activeAssignment, "ASN-001")).toBe(true);
    expect(matchesAssignmentSearch(activeAssignment, "Not Here")).toBe(false);
  });

  it("detects obvious assignment status mismatches for needs review", () => {
    const badAssignment = {
      ...activeAssignment,
      status: "RETURNED",
      signatureData: null,
      items: [{ ...activeAssignment.items[0], asset: { ...activeAssignment.items[0].asset, status: "AVAILABLE", employeeId: null } }],
    };

    expect(getAssignmentReviewReasons(badAssignment)).toEqual(
      expect.arrayContaining([
        "Returned/cancelled assignment still has active items",
        "Missing signature",
        "GHT-LP-11 status is AVAILABLE",
        "GHT-LP-11 has no responsibility target on the asset record",
      ]),
    );
  });
});
