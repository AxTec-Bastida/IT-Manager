import { describe, expect, it } from "vitest";
import { cleanTaskCategory, suggestedTaskCategoryFromSource, taskAssigneeLabel, taskAssignmentSnapshot } from "@/lib/tasks";

describe("task helpers", () => {
  it("maps legacy task categories to warehouse IT categories", () => {
    expect(cleanTaskCategory("INVENTORY")).toBe("ASSET_FOLLOW_UP");
    expect(cleanTaskCategory("STOCK")).toBe("STOCK_CONSUMABLES");
    expect(cleanTaskCategory("RMA")).toBe("REPAIR_RMA");
  });

  it("suggests task categories from source context", () => {
    expect(suggestedTaskCategoryFromSource({ deviceId: "device-1" })).toBe("ASSET_FOLLOW_UP");
    expect(suggestedTaskCategoryFromSource({ stockItemId: "stock-1" })).toBe("STOCK_CONSUMABLES");
    expect(suggestedTaskCategoryFromSource({ auditId: "audit-1" })).toBe("AUDIT_FINDING");
    expect(suggestedTaskCategoryFromSource({ alertType: "WARRANTY_EXPIRING" })).toBe("WARRANTY_FACTURA");
  });

  it("uses AppUser assignment snapshots while preserving legacy assignee text when unassigned", () => {
    expect(taskAssignmentSnapshot({ id: "user-1", name: "IT Admin", role: "ADMIN" })).toEqual({
      assignedToUserId: "user-1",
      assignedToName: "IT Admin",
      assignedToRole: "ADMIN",
      assignedTo: "IT Admin",
    });
    expect(taskAssignmentSnapshot(null, "Old assignee")).toEqual({
      assignedToUserId: null,
      assignedToName: null,
      assignedToRole: null,
      assignedTo: "Old assignee",
    });
  });

  it("renders task assignee labels for users, snapshots, legacy text, and open tasks", () => {
    expect(taskAssigneeLabel({ assignedToUserId: "user-1", assignedToName: "IT Admin", assignedToRole: "ADMIN", assignedTo: "IT Admin", assignedToUser: { name: "IT Admin", role: "ADMIN" } })).toBe("IT Admin (ADMIN)");
    expect(taskAssigneeLabel({ assignedToUserId: null, assignedToName: "Tech One", assignedToRole: "IT_STAFF", assignedTo: "Tech One" })).toBe("Tech One (IT_STAFF)");
    expect(taskAssigneeLabel({ assignedToUserId: null, assignedToName: null, assignedToRole: null, assignedTo: "Legacy name" })).toBe("Legacy name (legacy)");
    expect(taskAssigneeLabel({ assignedToUserId: null, assignedToName: null, assignedToRole: null, assignedTo: null })).toBe("Open / Unassigned");
  });
});
