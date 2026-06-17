import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportExportRows, isReportType, reportDefinitions, reportPermission, reportTypes, type ReportData } from "@/lib/reports";

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("@/lib/auth");
  vi.doUnmock("@/lib/reports");
});

describe("reports lite helpers", () => {
  it("defines the expected operational report types", () => {
    expect(reportTypes).toEqual(["inventory", "assignments", "loans", "stock", "network", "photos", "audits", "rma", "warranty", "maintenance", "asset-values", "tasks"]);
    expect(isReportType("inventory")).toBe(true);
    expect(isReportType("not-a-report")).toBe(false);
  });

  it("uses report-specific permissions for protected areas", () => {
    expect(reportPermission("inventory")).toBe("inventory.read");
    expect(reportPermission("maintenance")).toBe("inventory.read");
    expect(reportPermission("audits")).toBe("audits.read");
    expect(reportPermission("tasks")).toBe("tasks.read");
  });

  it("keeps stock wording focused on the stockroom workflow", () => {
    expect(reportDefinitions.stock.title).toBe("Stockroom Report");
    expect(reportDefinitions.stock.description).toContain("Low stock");
    expect(reportDefinitions["asset-values"].description).toContain("Internal purchase values");
  });

  it("builds deterministic summary and section CSV rows without secret-style fields", () => {
    const report: ReportData = {
      type: "inventory",
      title: "Inventory Report",
      description: "Summary",
      exportHref: "/api/reports/inventory/export",
      primaryHref: "/devices",
      metrics: [{ label: "Total assets", value: 2, helper: "Serialized inventory" }],
      sections: [
        {
          title: "Assets by category",
          rows: [{ label: "Laptop", value: 1, helper: "Daily inventory", href: "/inventory/laptops", actionHref: "/tasks/new?title=Review" }],
        },
      ],
    };

    const rows = buildReportExportRows(report);
    expect(rows).toEqual([
      { report: "Inventory Report", section: "Summary", label: "Total assets", value: 2, helper: "Serialized inventory", badges: "", href: "", actionHref: "" },
      { report: "Inventory Report", section: "Assets by category", label: "Laptop", value: 1, helper: "Daily inventory", badges: "", href: "/inventory/laptops", actionHref: "/tasks/new?title=Review" },
    ]);
    expect(Object.keys(rows[0])).not.toContain("password");
    expect(Object.keys(rows[0])).not.toContain("bitLockerKey");
    expect(Object.keys(rows[0])).not.toContain("smtpPassword");
  });
});

describe("report export API", () => {
  it("exports a valid report as CSV after permission checks", async () => {
    const requirePermission = vi.fn(async () => ({ id: "user-1" }));
    vi.doMock("@/lib/auth", () => ({ requirePermission }));
    vi.doMock("@/lib/reports", () => ({
      getReportExportRows: vi.fn(async () => [{ report: "Inventory Report", section: "Summary", label: "Total assets", value: 2, helper: "", badges: "", href: "", actionHref: "" }]),
      isReportType: (value: string) => value === "inventory",
      reportPermission: () => "inventory.read",
      reportTypeListMessage: () => "inventory",
    }));

    const route = await import("../app/api/reports/[type]/export/route");
    const response = await route.GET(new Request("http://test/api/reports/inventory/export"), { params: Promise.resolve({ type: "inventory" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("report-inventory.csv");
    expect(await response.text()).toContain("Inventory Report,Summary,Total assets,2");
    expect(requirePermission).toHaveBeenCalledWith("inventory.read");
  });

  it("rejects invalid report types for authenticated users", async () => {
    vi.doMock("@/lib/auth", () => ({ requirePermission: vi.fn(async () => ({ id: "user-1" })) }));
    vi.doMock("@/lib/reports", () => ({
      getReportExportRows: vi.fn(),
      isReportType: () => false,
      reportPermission: () => "inventory.read",
      reportTypeListMessage: () => "inventory, tasks",
    }));

    const route = await import("../app/api/reports/[type]/export/route");
    const response = await route.GET(new Request("http://test/api/reports/bad/export"), { params: Promise.resolve({ type: "bad" }) });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Report type must be one of");
  });

  it("returns 401 when export is requested without authentication", async () => {
    const { AuthRequiredError } = await import("@/lib/auth-errors");
    vi.doMock("@/lib/auth", () => ({ requirePermission: vi.fn(async () => { throw new AuthRequiredError(); }) }));
    vi.doMock("@/lib/reports", () => ({
      getReportExportRows: vi.fn(),
      isReportType: (value: string) => value === "inventory",
      reportPermission: () => "inventory.read",
      reportTypeListMessage: () => "inventory",
    }));

    const route = await import("../app/api/reports/[type]/export/route");
    const response = await route.GET(new Request("http://test/api/reports/inventory/export"), { params: Promise.resolve({ type: "inventory" }) });

    expect(response.status).toBe(401);
    expect(await response.text()).toContain("Authentication required");
  });

  it("returns 403 when a user lacks the report permission", async () => {
    const { ForbiddenError } = await import("@/lib/auth-errors");
    const requirePermission = vi.fn(async (permission: string) => {
      if (permission === "tasks.read") throw new ForbiddenError();
      return { id: "user-1" };
    });
    vi.doMock("@/lib/auth", () => ({ requirePermission }));
    vi.doMock("@/lib/reports", () => ({
      getReportExportRows: vi.fn(),
      isReportType: (value: string) => value === "tasks",
      reportPermission: () => "tasks.read",
      reportTypeListMessage: () => "tasks",
    }));

    const route = await import("../app/api/reports/[type]/export/route");
    const response = await route.GET(new Request("http://test/api/reports/tasks/export"), { params: Promise.resolve({ type: "tasks" }) });

    expect(response.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith("inventory.read");
    expect(requirePermission).toHaveBeenCalledWith("tasks.read");
  });
});
