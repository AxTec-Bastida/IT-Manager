import { describe, expect, it } from "vitest";
import { assetFacturaExportFields, facturaRelationId, normalizeLinkedIds } from "@/lib/facturas";
import { facturaSchema } from "@/lib/validation";
import { generateSafeFilename, shouldSetPrimaryPhoto, validateUploadFile } from "@/lib/uploads";

describe("upload validation", () => {
  it("accepts asset photo image types and rejects unsupported files", () => {
    expect(validateUploadFile({ kind: "asset-photo", mimeType: "image/jpeg", fileSize: 100 }).ok).toBe(true);
    expect(validateUploadFile({ kind: "asset-photo", mimeType: "application/pdf", fileSize: 100 }).ok).toBe(false);
  });

  it("accepts factura PDFs and rejects oversize uploads", () => {
    expect(validateUploadFile({ kind: "factura", mimeType: "application/pdf", fileSize: 100 }).ok).toBe(true);
    expect(validateUploadFile({ kind: "factura", mimeType: "application/pdf", fileSize: 20 * 1024 * 1024 }).ok).toBe(false);
  });

  it("generates safe unique filenames without trusting the original name", () => {
    const filename = generateSafeFilename("image/png", "asset-photo", new Date("2026-05-05T12:00:00Z"));
    expect(filename).toMatch(/^20260505-[a-f0-9-]+\.png$/);
    expect(filename).not.toContain("..");
  });
});

describe("photo primary behavior", () => {
  it("sets first photo as primary and respects explicit primary requests", () => {
    expect(shouldSetPrimaryPhoto(0, false)).toBe(true);
    expect(shouldSetPrimaryPhoto(2, false)).toBe(false);
    expect(shouldSetPrimaryPhoto(2, true)).toBe(true);
  });
});

describe("factura validation and linking", () => {
  it("validates required factura creation fields", () => {
    const parsed = facturaSchema.safeParse({ facturaNumber: "F-1001", vendorName: "Zebra Supplies", totalAmount: "1200.50", currency: "USD" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.totalAmount).toBe(1200.5);
  });

  it("normalizes factura links for assets and stock items", () => {
    expect(normalizeLinkedIds(["asset-1", "asset-1", "", "stock-2"])).toEqual(["asset-1", "stock-2"]);
    expect(facturaRelationId(" factura-1 ")).toBe("factura-1");
    expect(facturaRelationId("")).toBeNull();
  });

  it("builds asset export factura/photo fields", () => {
    const fields = assetFacturaExportFields({
      factura: { facturaNumber: "F-1001", vendorName: "Zebra", purchaseDate: new Date("2026-05-05"), totalAmount: 500, currency: "USD" },
      photos: [{ id: "p1" }, { id: "p2" }],
    });
    expect(fields.facturaNumber).toBe("F-1001");
    expect(fields.photoCount).toBe(2);
  });
});
