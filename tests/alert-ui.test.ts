import { describe, expect, it } from "vitest";
import { alertActionSuccessMessage, getAlertActionPanel } from "@/components/alert-actions";
import { alertFilterHref, alertSourceLabel, buildActiveAlertFilters, formatAlertTextForUi, visibleAlertSourceOptions } from "@/lib/alert-ui";

describe("alert center UI helpers", () => {
  it("does not show a resolution textarea by default", () => {
    expect(getAlertActionPanel("idle").showNote).toBe(false);
    expect(getAlertActionPanel("idle").confirmStatus).toBeNull();
  });

  it("reveals the resolution note panel only after resolve is selected", () => {
    const panel = getAlertActionPanel("resolve");
    expect(panel.showNote).toBe(true);
    expect(panel.confirmStatus).toBe("RESOLVED");
    expect(panel.confirmLabel).toBe("Confirm Resolve");
  });

  it("reveals the ignore note panel only after ignore is selected", () => {
    const panel = getAlertActionPanel("ignore");
    expect(panel.showNote).toBe(true);
    expect(panel.confirmStatus).toBe("IGNORED");
    expect(panel.confirmLabel).toBe("Confirm Ignore");
  });

  it("keeps user feedback clear for status actions", () => {
    expect(alertActionSuccessMessage("ACKNOWLEDGED")).toBe("Alert acknowledged.");
    expect(alertActionSuccessMessage("RESOLVED")).toBe("Alert resolved.");
    expect(alertActionSuccessMessage("IGNORED")).toBe("Alert ignored.");
  });

  it("builds active filter chips and clearable alert URLs", () => {
    expect(buildActiveAlertFilters({ status: "OPEN", source: "STOCK", type: "LOW_STOCK" })).toEqual(["Open", "Stock", "Low Stock"]);
    expect(alertFilterHref({ status: "OPEN", source: "STOCK" })).toBe("/alerts?status=OPEN&source=STOCK");
    expect(alertFilterHref({ status: "" })).toBe("/alerts");
  });

  it("hides legacy AP sync from normal source filters", () => {
    expect(visibleAlertSourceOptions()).not.toContain("UNIFI");
    expect(visibleAlertSourceOptions("UNIFI")).toContain("UNIFI");
  });

  it("labels legacy AP sync as disabled instead of active setup", () => {
    expect(alertSourceLabel("UNIFI")).toBe("Legacy AP Sync (Disabled)");
    expect(alertSourceLabel("UNIFI")).not.toContain("Read-only");
  });

  it("formats old alert messages without active UniFi wording", () => {
    expect(formatAlertTextForUi("Verify labels or switch/UniFi client data.")).toBe("Verify labels or switch/network client data.");
    expect(formatAlertTextForUi("UniFi sync note")).toBe("legacy AP sync sync note");
  });
});
