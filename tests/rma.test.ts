import { describe, expect, it } from "vitest";
import {
  buildRmaAlertCandidate,
  deviceUpdateForRmaResult,
  expectedFollowUpDate,
  isRmaFollowUpDue,
  statusFromRmaItems,
} from "@/lib/rma";

describe("RMA workflow rules", () => {
  it("sets follow-up due after the reminder window", () => {
    const sentAt = new Date("2026-05-01T12:00:00Z");
    expect(expectedFollowUpDate(sentAt, 7)?.toISOString().slice(0, 10)).toBe("2026-05-08");
    expect(isRmaFollowUpDue({ status: "ACTIVE", sentAt, expectedFollowUpAt: null, reminderAfterDays: 7 }, new Date("2026-05-08T12:00:00Z"))).toBe(true);
  });

  it("maps repaired and returned-as-is devices back to available", () => {
    expect(deviceUpdateForRmaResult("REPAIRED", "GOOD")).toEqual({ status: "AVAILABLE", condition: "GOOD" });
    expect(deviceUpdateForRmaResult("RETURNED_AS_IS", "FAIR")).toEqual({ status: "AVAILABLE", condition: "FAIR" });
  });

  it("maps lost and retired RMA results to historical statuses", () => {
    expect(deviceUpdateForRmaResult("LOST")).toEqual({ status: "LOST", condition: "NEEDS_REVIEW" });
    expect(deviceUpdateForRmaResult("RETIRED")).toEqual({ status: "RETIRED", condition: "NEEDS_REVIEW" });
    expect(deviceUpdateForRmaResult("REPLACED")).toEqual({ status: "RETIRED", condition: "NEEDS_REVIEW" });
  });

  it("marks RMA status returned or partial based on item results", () => {
    expect(statusFromRmaItems([{ result: "PENDING", returnedAt: null }])).toBe("ACTIVE");
    expect(statusFromRmaItems([{ result: "REPAIRED", returnedAt: new Date() }, { result: "PENDING", returnedAt: null }])).toBe("PARTIALLY_RETURNED");
    expect(statusFromRmaItems([{ result: "REPAIRED", returnedAt: new Date() }, { result: "LOST", returnedAt: new Date() }])).toBe("RETURNED");
  });

  it("builds duplicate-suppressible RMA reminder metadata", () => {
    const alert = buildRmaAlertCandidate({
      id: "rma-1",
      rmaNumber: "14",
      title: null,
      destination: "USA",
      vendorName: null,
      contactName: null,
      contactEmail: null,
      carrier: null,
      trackingNumber: null,
      sentAt: new Date("2026-05-01T12:00:00Z"),
      expectedFollowUpAt: new Date("2026-05-08T12:00:00Z"),
      reminderAfterDays: 7,
      status: "ACTIVE",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [{ result: "PENDING", returnedAt: null } as never, { result: "REPAIRED", returnedAt: new Date() } as never],
    }, new Date("2026-05-09T12:00:00Z"));

    expect(alert?.type).toBe("RMA_OVERDUE");
    expect(alert?.title).toContain("14");
    expect(alert?.message).toContain("1 pending");
    expect(alert?.metadata).toContain("rma-1");
  });
});
