import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import {
  buildLegacyPreview,
  classifyLegacySheet,
  detectAssetDuplicate,
  detectStockDuplicate,
  matchLegacyColumn,
  orderLegacyRowsForCommit,
  redactSensitiveNote,
  sanitizeLegacyRawForAudit,
} from "@/lib/legacy-import";

function workbookBuffer(sheets: Record<string, unknown[][]>) {
  const workbook = utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), name);
  }
  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("legacy sheet classification and columns", () => {
  it("maps known tabs and ignores helper tabs by default", () => {
    expect(classifyLegacySheet("iPhone").kind).toBe("asset");
    expect(classifyLegacySheet("Otros").kind).toBe("stock");
    expect(classifyLegacySheet("ImpInvoice").kind).toBe("factura");
    expect(classifyLegacySheet("Hoja 42").defaultSelected).toBe(false);
    expect(classifyLegacySheet("ScannerBK").defaultSelected).toBe(false);
  });

  it("matches flexible legacy column names", () => {
    expect(matchLegacyColumn("New A/N")).toBe("assetTag");
    expect(matchLegacyColumn("S/N")).toBe("serialNumber");
    expect(matchLegacyColumn("Invoince")).toBe("invoice");
    expect(matchLegacyColumn("LOCATION/ STATUS / COMMENT")).toBe("location");
    expect(matchLegacyColumn("Garantía")).toBe("warrantyExpiresAt");
  });
});

describe("legacy workbook preview mapping", () => {
  it("builds a dry-run summary without writing records", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      iPhone: [["#", "AF", "A/N", "Brand", "Model", "S/N", "Invoice", "Vendor", "Status", "Assigned"], [1, "GHT-IPH-1", 100, "APPLE", "iPhone SE", "SER-1", "INV-1", "CO-PRODUCTION", "Operations", "Packing"]],
      "Hoja 42": [["helper"], ["ignore me"]],
    }), "sample.xlsx");

    expect(preview.summary.sheetsDetected).toBe(2);
    expect(preview.summary.rowsDetected).toBe(1);
    expect(preview.rows[0].target).toBe("device");
    expect(preview.rows[0].data.assetTag).toBe("GHT-IPH-1");
  });

  it("keeps mobile Apple devices out of network tracking by default", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      iPad: [["#", "New ID", "Brand", "Model", "S/N", "IP Address", "Status"], [1, "GHT-IPA-1", "APPLE", "9th Gen", "SER-IPAD", "192.168.163.55", "Operations"]],
    }), "sample.xlsx");

    expect(preview.rows[0].data.category).toBe("TABLET");
    expect(preview.rows[0].data.ipAddress).toBeNull();
    expect(preview.rows[0].data.usesStaticIp).toBe(false);
    expect(preview.rows[0].data.movementAlertsEnabled).toBe(false);
    expect(preview.rows[0].warnings.join(" ")).toContain("without IP/MAC requirements");
  });

  it("allows scale IP and static tracking without UniFi", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Scale: [["New A/N", "BRAND", "MODEL", "S/N", "IP", "STATUS", "ASSIGNED"], ["GHT-SC-1", "METTLER TOLEDO", "BC60", "SC-1", "192.168.163.232", "OPERACIONES", "PANDA 4"]],
    }), "sample.xlsx");

    expect(preview.rows[0].data.category).toBe("SCALE");
    expect(preview.rows[0].data.ipAddress).toBe("192.168.163.232");
    expect(preview.rows[0].data.usesStaticIp).toBe(true);
    expect(preview.rows[0].data.isFixedAsset).toBe(true);
  });

  it("redacts credential-looking notes and reports a warning", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      IMPF: [["New A/N", "BRAND", "MODEL", "DEVICE", "S/N", "NOTE"], ["GHT-MF-1", "CANON", "ImageRunner", "Printer", "PR-1", "User:147369 Pass:147369"]],
    }), "sample.xlsx");

    expect(String(preview.rows[0].data.notes)).toContain("Pass: [REDACTED]");
    expect(String(preview.rows[0].data.notes)).not.toContain("147369");
    expect(preview.summary.redactedNotes).toBe(1);
  });

  it("maps ImpInvoice rows for factura-to-serial linking", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      ImpInvoice: [["Invoince", "SN", "ARRIVAL DATE", "NOTE"], ["25-TEC-AF-FI-0003", "BRN008296UN24", "08/30/2025", "arrived"]],
    }), "sample.xlsx");

    expect(preview.rows[0].target).toBe("factura");
    expect(preview.rows[0].data.facturaNumber).toBe("25-TEC-AF-FI-0003");
    expect(preview.rows[0].data.serialNumber).toBe("BRN008296UN24");
    expect(preview.rows[0].warnings.join(" ")).toContain("link serial");
  });

  it("validates IP fields as warnings instead of killing the row", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      IMPT: [["New A/N", "BRAND", "MODEL", "DEVICE", "S/N", "IP Address"], ["GHT-TP-1", "ZEBRA", "ZT411", "Thermal Printer", "TP-1", "192.168.163.999"]],
    }), "sample.xlsx");

    expect(preview.rows[0].ok).toBe(true);
    expect(preview.rows[0].data.ipAddress).toBeNull();
    expect(preview.rows[0].warnings.join(" ")).toContain("Invalid IP ignored");
  });

  it("skips legacy stock side-table rows but keeps real battery stock rows", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Baterias: [
        ["", "", "", "", "", "", "", "", "", "", ""],
        ["Area", "QTY", "QTY", "", "", "", "", "", "", "", ""],
        ["Toolcrib Replen", 279, 378, "", "", "", "", "Fecha", "Factura", "Tipo", "QTY"],
        ["", "", "", "", "", "uso replen", 11, "", "", "", ""],
      ],
    }), "sample.xlsx");

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].ok).toBe(true);
    expect(preview.rows[0].data.name).toBe("Baterias");
    expect(preview.rows[0].warnings.join(" ")).toContain("inferred");
  });

  it("uses Arm Display Base blank first-column labels as stock names", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      "Arm  Display Base": [
        ["Operations", "", ""],
        ["", "Amount", "Location"],
        ["Assembled", 83, "PandA 1-7"],
        ["", "Amount", "Status"],
        ["Arm Base", 23, "WITH IT"],
      ],
    }), "sample.xlsx");

    expect(preview.rows).toHaveLength(2);
    expect(preview.rows.map((row) => row.data.name)).toEqual(["Arm Display Base Assembled", "Arm Base"]);
    expect(preview.summary.errorRows).toBe(0);
  });

  it("skips comment-like stock rows without skipping real stock names", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Consumibles: [
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
        ["Item", "QTY", "Vendor"],
        ["Comentarios", "", ""],
        ["Falta crear iPhone J136", "", ""],
        ["Display Base", 3, ""],
        ["Arm Base", 2, ""],
        ["Zebra cs6080 Cable", 4, ""],
      ],
    }), "sample.xlsx");

    expect(preview.rows).toHaveLength(5);
    expect(preview.rows[0].action).toBe("skip");
    expect(preview.rows[1].action).toBe("skip");
    expect(preview.rows[0].warnings.join(" ")).toContain("comment-like stock row");
    expect(preview.rows[1].warnings.join(" ")).toContain("comment-like stock row");
    expect(preview.rows.slice(2).map((row) => row.data.name)).toEqual(["Display Base", "Arm Base", "Zebra cs6080 Cable"]);
    expect(preview.rows.slice(2).map((row) => row.data.category)).toEqual(["DISPLAY_BASE", "DISPLAY_BASE", "CABLE"]);
    expect(preview.summary.skippedCommentLikeStockRows).toBe(2);
  });

  it("does not assign ACCESS POINT as a laptop display name", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Laptop: [
        ["New ID", "DEVICE", "Brand", "Model", "S/N"],
        ["GHT-LP-1", "ACCESS POINT", "DELL", "Latitude 3520", "SER-LP-1"],
      ],
      Infraestructura: [
        ["A/N", "BRAND", "MODEL", "DEVICE", "S/N"],
        ["GHT-AP-1", "Ubiquiti", "U6-LR", "ACCESS POINT", "AP-SER-1"],
      ],
    }), "sample.xlsx");

    const laptop = preview.rows.find((row) => row.sheetName === "Laptop");
    const accessPoint = preview.rows.find((row) => row.sheetName === "Infraestructura");
    expect(laptop?.data.name).toBe("DELL Latitude 3520");
    expect(laptop?.data.category).toBe("LAPTOP");
    expect(accessPoint?.data.name).toBe("ACCESS POINT");
    expect(accessPoint?.data.category).toBe("ACCESS_POINT");
  });

  it("imports Sled rows with a sled display name instead of a generic Other name", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Sled: [
        ["New ID", "A/N", "Brand", "Model", "S/N", "Assigned"],
        ["GHT-SLD-190", "190", "Infinite Peripherals", "Infinea X", "SER-SLD-190", "NO ASIGNADO"],
      ],
    }), "sample.xlsx");

    expect(preview.rows[0].data.assetTag).toBe("GHT-SLD-190");
    expect(preview.rows[0].data.name).toBe("Sled GHT-SLD-190");
    expect(preview.rows[0].data.category).toBe("OTHER");
    expect(preview.rows[0].data.assignedTo).toBeNull();
    expect(preview.rows[0].data.legacyAliases).toEqual([
      { aliasType: "OLD_AN", value: "190", sourceSheet: "Sled", sourceColumn: "A/N", sourceRow: 2 },
    ]);
  });

  it("maps Infraestructura side-table access point rows instead of flagging missing IDs", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Infraestructura: [
        ["A/N", "BRAND", "MODEL", "DEVICE", "S/N", "INVOICE", "VENDOR", "COMMENTS", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "U6-LR", "AC8BA92DF1A3", ""],
      ],
    }), "sample.xlsx");

    expect(preview.rows[0].ok).toBe(true);
    expect(preview.rows[0].data.category).toBe("ACCESS_POINT");
    expect(preview.rows[0].data.model).toBe("U6-LR");
    expect(preview.rows[0].data.serialNumber).toBe("AC8BA92DF1A3");
    expect(preview.rows[0].data.macAddress).toBe("AC:8B:A9:2D:F1:A3");
  });
});

describe("legacy duplicate detection", () => {
  it("detects asset duplicates by priority and treats IP as warning-only", () => {
    const existing = { devices: [{ id: "dev-1", name: "Existing scanner", assetTag: "GHT-SCR-1", serialNumber: "SER-1", macAddress: null, ipAddress: "192.168.163.10" }] };
    expect(detectAssetDuplicate({ data: { assetTag: "GHT-SCR-1", serialNumber: "OTHER" } }, existing)?.type).toBe("assetTag");
    expect(detectAssetDuplicate({ data: { ipAddress: "192.168.163.10" } }, existing)?.warningOnly).toBe(true);
  });

  it("detects stock duplicates by SKU or name and category", () => {
    const existing = { stockItems: [{ id: "stock-1", name: "Sled battery", sku: "BAT-1", category: "BATTERY" as const }] };
    expect(detectStockDuplicate({ data: { sku: "BAT-1" } }, existing)?.id).toBe("stock-1");
    expect(detectStockDuplicate({ data: { name: "Sled battery", category: "BATTERY" } }, existing)?.id).toBe("stock-1");
  });

  it("does not imply destructive behavior for existing records", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Laptop: [["New ID", "A/N", "Brand", "Model", "S/N", "Status"], ["GHT-LP-1", 100, "DELL", "Latitude", "SER-LP", "ACTIVE"]],
    }), "sample.xlsx", { existing: { devices: [{ id: "dev-1", name: "Existing laptop", assetTag: "GHT-LP-1", serialNumber: null, macAddress: null, ipAddress: null }] } });

    expect(preview.rows[0].action).toBe("update");
    expect(preview.rows[0].warnings.join(" ")).toContain("Matched existing");
  });

  it("skips duplicate exact asset tags inside the same workbook instead of creating duplicates", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      Scanner: [
        ["New ID", "Brand", "Model", "S/N"],
        ["GHT-SCN-1", "ZEBRA", "TC57", "SER-1"],
        ["GHT-SCN-1", "ZEBRA", "TC57", "SER-2"],
      ],
    }), "sample.xlsx");

    expect(preview.rows[0].action).toBe("create");
    expect(preview.rows[1].action).toBe("skip");
    expect(preview.rows[1].warnings.join(" ")).toContain("Duplicate assetTag inside workbook");
    expect(preview.summary.duplicateRows).toBe(1);
  });
});

describe("legacy final import ordering", () => {
  it("commits device rows before factura rows so serial links can attach to new assets", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      ImpInvoice: [["Invoince", "SN", "ARRIVAL DATE", "NOTE"], ["INV-1", "SER-1", "08/30/2025", "arrived"]],
      Laptop: [["New ID", "Brand", "Model", "S/N"], ["GHT-LP-1", "DELL", "Latitude", "SER-1"]],
    }), "sample.xlsx");

    expect(preview.rows.map((row) => row.target)).toEqual(["factura", "device"]);
    expect(orderLegacyRowsForCommit(preview.rows).map((row) => row.target)).toEqual(["device", "factura"]);
  });
});

describe("legacy note redaction", () => {
  it("redacts password values directly", () => {
    const redacted = redactSensitiveNote("Printer note User:admin Pass:secret123");
    expect(redacted.redacted).toBe(true);
    expect(redacted.value).toBe("Printer note User: [REDACTED] Pass: [REDACTED]");
  });

  it("redacts credential-looking raw audit data before ImportRowError storage", () => {
    const raw = sanitizeLegacyRawForAudit({ NOTE: "Printer note User:admin Pass:secret123" });

    expect(JSON.stringify(raw)).toContain("[REDACTED]");
    expect(JSON.stringify(raw)).not.toContain("secret123");
    expect(JSON.stringify(raw)).not.toContain("admin");
  });
});
