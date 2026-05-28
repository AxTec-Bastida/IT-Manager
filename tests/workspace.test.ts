import { describe, expect, it } from "vitest";
import { purchaseNoteSchema, taskSchema, toolLinkSchema } from "@/lib/validation";
import { favoriteToolLinks, isPurchaseFollowUpDue, isTaskDueToday, isTaskOverdue, purchaseNoteCanTransition, taskCanTransition } from "@/lib/workspace";

describe("quick task validation and workflow", () => {
  it("validates a lightweight task with defaults", () => {
    const result = taskSchema.safeParse({ title: "Replace printhead", dueDate: "2026-05-28" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("OPEN");
      expect(result.data.priority).toBe("MEDIUM");
      expect(result.data.category).toBe("GENERAL");
    }
  });

  it("supports allowed task status transitions only", () => {
    expect(taskCanTransition("OPEN", "IN_PROGRESS")).toBe(true);
    expect(taskCanTransition("WAITING", "DONE")).toBe(true);
    expect(taskCanTransition("DONE", "OPEN")).toBe(false);
  });

  it("detects overdue and due-today tasks", () => {
    const now = new Date("2026-05-28T12:00:00");

    expect(isTaskOverdue({ dueDate: new Date("2026-05-27T09:00:00"), status: "OPEN" }, now)).toBe(true);
    expect(isTaskDueToday({ dueDate: new Date("2026-05-28T09:00:00"), status: "IN_PROGRESS" }, now)).toBe(true);
    expect(isTaskOverdue({ dueDate: new Date("2026-05-27T09:00:00"), status: "DONE" }, now)).toBe(false);
  });
});

describe("po tracker validation and workflow", () => {
  it("validates purchase notes and item rows", () => {
    const result = purchaseNoteSchema.safeParse({
      title: "PO-1044 keyboards and mice",
      vendorName: "CDW",
      estimatedAmount: "1250.50",
      items: [{ description: "Keyboard", quantity: "10", unitCost: "25" }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DRAFT");
      expect(result.data.currency).toBe("USD");
      expect(result.data.items[0].quantity).toBe(10);
    }
  });

  it("supports simple PO status transitions", () => {
    expect(purchaseNoteCanTransition("DRAFT", "REQUESTED")).toBe(true);
    expect(purchaseNoteCanTransition("ORDERED", "FACTURA_PENDING")).toBe(true);
    expect(purchaseNoteCanTransition("CLOSED", "ORDERED")).toBe(false);
  });

  it("detects follow-up due without reopening closed notes", () => {
    const now = new Date("2026-05-28T12:00:00");

    expect(isPurchaseFollowUpDue({ followUpDate: new Date("2026-05-28T08:00:00"), status: "ORDERED" }, now)).toBe(true);
    expect(isPurchaseFollowUpDue({ followUpDate: new Date("2026-05-27T08:00:00"), status: "CLOSED" }, now)).toBe(false);
  });
});

describe("resource link validation and filtering", () => {
  it("validates tool URLs and blocks secrets in notes", () => {
    expect(toolLinkSchema.safeParse({ name: "UniFi Network", url: "https://unifi.example.com", category: "NETWORK" }).success).toBe(true);
    expect(toolLinkSchema.safeParse({ name: "Bad URL", url: "unifi.local", category: "NETWORK" }).success).toBe(false);
    expect(toolLinkSchema.safeParse({ name: "Vault", url: "https://vault.example.com", category: "DOCUMENTS_SOPS", notes: "password is test" }).success).toBe(false);
  });

  it("filters active favorites only and accepts resource categories", () => {
    const links = [
      { name: "Google Admin", isFavorite: true, active: true },
      { name: "Old portal", isFavorite: true, active: false },
      { name: "Vendor", isFavorite: false, active: true },
    ];

    expect(favoriteToolLinks(links).map((link) => link.name)).toEqual(["Google Admin"]);
    expect(toolLinkSchema.safeParse({ name: "SOP", url: "https://docs.example.com", category: "DOCUMENTS_SOPS" }).success).toBe(true);
  });
});
