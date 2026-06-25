import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { activeFacturaWhere, assetFacturaExportFields, facturaRelationId, normalizeLinkedIds, reviewFacturaHardDeleteSafety } from "@/lib/facturas";
import { facturaSchema } from "@/lib/validation";
import { generateSafeFilename, isSafeUploadFilename, shouldSetPrimaryPhoto, uploadContentType, validateMapFileBytes, validateUploadFile } from "@/lib/uploads";

const createdUploadFiles: string[] = [];

afterEach(async () => {
  vi.resetModules();
  vi.doUnmock("@/lib/prisma");
  await Promise.all(createdUploadFiles.splice(0).map((filePath) => rm(filePath, { force: true })));
});

describe("upload validation", () => {
  it("accepts asset photo image types and rejects unsupported files", () => {
    expect(validateUploadFile({ kind: "asset-photo", mimeType: "image/jpeg", fileSize: 100 }).ok).toBe(true);
    expect(validateUploadFile({ kind: "stock-photo", mimeType: "image/webp", fileSize: 100 }).ok).toBe(true);
    expect(validateUploadFile({ kind: "asset-photo", mimeType: "application/pdf", fileSize: 100 }).ok).toBe(false);
  });

  it("accepts factura PDFs and rejects oversize uploads", () => {
    expect(validateUploadFile({ kind: "factura", mimeType: "application/pdf", fileSize: 100 }).ok).toBe(true);
    expect(validateUploadFile({ kind: "factura", mimeType: "application/pdf", fileSize: 20 * 1024 * 1024 }).ok).toBe(false);
  });

  it("accepts map images and rejects unsafe SVG map content", () => {
    expect(validateUploadFile({ kind: "map", mimeType: "image/png", fileSize: 100 }).ok).toBe(true);
    expect(validateUploadFile({ kind: "map", mimeType: "image/svg+xml", fileSize: 100 }).ok).toBe(true);
    expect(validateUploadFile({ kind: "map", mimeType: "text/html", fileSize: 100 }).ok).toBe(false);
    expect(validateMapFileBytes("image/svg+xml", Buffer.from("<svg><rect width='10' height='10'/></svg>")).ok).toBe(true);
    expect(validateMapFileBytes("image/svg+xml", Buffer.from("<svg><script>alert(1)</script></svg>")).ok).toBe(false);
    expect(validateMapFileBytes("image/svg+xml", Buffer.from("<svg><image href='https://example.com/a.png'/></svg>")).ok).toBe(false);
  });

  it("generates safe unique filenames without trusting the original name", () => {
    const filename = generateSafeFilename("image/png", "asset-photo", new Date("2026-05-05T12:00:00Z"));
    expect(filename).toMatch(/^20260505-[a-f0-9-]+\.png$/);
    expect(filename).not.toContain("..");
  });

  it("rejects unsafe upload filenames and resolves allowed content types", () => {
    expect(isSafeUploadFilename("20260505-safe-file.png")).toBe(true);
    expect(isSafeUploadFilename("../secret.png")).toBe(false);
    expect(isSafeUploadFilename("nested\\secret.png")).toBe(false);
    expect(uploadContentType("text/html", "invoice.pdf", "facturas")).toBe("application/pdf");
    expect(uploadContentType("text/html", "asset.png", "assets")).toBe("image/png");
    expect(uploadContentType("text/html", "stock.jpg", "stock")).toBe("image/jpeg");
    expect(uploadContentType("text/html", "map.svg", "maps")).toBe("image/svg+xml");
    expect(uploadContentType("text/html", "script.svg", "assets")).toBeNull();
  });

  it("serves valid asset photo uploads and blocks missing/path traversal requests", async () => {
    const filename = "phase23a-test-asset.png";
    const uploadPath = await writeUploadFixture("uploads/assets", filename, "asset-photo");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        assetPhoto: {
          findFirst: vi.fn(async ({ where }) =>
            where.storedFilename === filename
              ? { storedFilename: filename, mimeType: "image/png", originalFilename: "asset.png" }
              : null,
          ),
        },
      },
    }));
    const route = await import("../app/uploads/assets/[filename]/route");

    const ok = await route.GET(new Request("http://test/uploads/assets/phase23a-test-asset.png"), { params: Promise.resolve({ filename }) });
    const missing = await route.GET(new Request("http://test/uploads/assets/missing.png"), { params: Promise.resolve({ filename: "missing.png" }) });
    const blocked = await route.GET(new Request("http://test/uploads/assets/../secret.png"), { params: Promise.resolve({ filename: "../secret.png" }) });

    expect(uploadPath).toContain(filename);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await ok.text()).toBe("asset-photo");
    expect(missing.status).toBe(404);
    expect(blocked.status).toBe(404);
  });

  it("serves valid factura uploads with PDF content type", async () => {
    const filename = "phase23a-test-factura.pdf";
    await writeUploadFixture("uploads/facturas", filename, "%PDF-1.4 test");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        factura: {
          findFirst: vi.fn(async ({ where }) =>
            where.storedFilename === filename || where.OR?.some((item: { storedFilename?: string }) => item.storedFilename === filename)
              ? { storedFilename: filename, mimeType: "application/pdf", originalFilename: "invoice.pdf" }
              : null,
          ),
        },
      },
    }));
    const route = await import("../app/uploads/facturas/[filename]/route");

    const response = await route.GET(new Request("http://test/uploads/facturas/phase23a-test-factura.pdf"), { params: Promise.resolve({ filename }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("invoice.pdf");
  });

  it("serves valid factura XML uploads with XML content type", async () => {
    vi.resetModules();
    const filename = "phase65-test-factura.xml";
    await writeUploadFixture("uploads/facturas", filename, "<cfdi:Comprobante />");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        factura: {
          findFirst: vi.fn(async () => ({ xmlFilename: filename, xmlMimeType: "application/xml", xmlOriginalName: "invoice.xml" })),
        },
      },
    }));
    const route = await import("../app/uploads/facturas/[filename]/route");

    const response = await route.GET(new Request("http://test/uploads/facturas/phase65-test-factura.xml"), { params: Promise.resolve({ filename }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml");
    expect(response.headers.get("content-disposition")).toContain("invoice.xml");
  });

  it("serves valid asset thumbnails and stock photos safely", async () => {
    const assetThumb = "asset-thumb.jpg";
    const stockPhoto = "stock-photo.jpg";
    await writeUploadFixture("uploads/assets/thumbs", assetThumb, "asset-thumb");
    await writeUploadFixture("uploads/stock", stockPhoto, "stock-photo");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        assetPhoto: {
          findFirst: vi.fn(async ({ where }) => (where.thumbnailFilename === assetThumb ? { thumbnailFilename: assetThumb, originalFilename: "asset.jpg" } : null)),
        },
        stockItemPhoto: {
          findFirst: vi.fn(async ({ where }) => (where.storedFilename === stockPhoto ? { storedFilename: stockPhoto, mimeType: "image/jpeg", originalFilename: "stock.jpg" } : null)),
        },
      },
    }));

    const assetThumbRoute = await import("../app/uploads/assets/thumbs/[filename]/route");
    const stockRoute = await import("../app/uploads/stock/[filename]/route");
    const thumbResponse = await assetThumbRoute.GET(new Request("http://test/uploads/assets/thumbs/asset-thumb.jpg"), { params: Promise.resolve({ filename: assetThumb }) });
    const stockResponse = await stockRoute.GET(new Request("http://test/uploads/stock/stock-photo.jpg"), { params: Promise.resolve({ filename: stockPhoto }) });
    const blocked = await stockRoute.GET(new Request("http://test/uploads/stock/../secret.jpg"), { params: Promise.resolve({ filename: "../secret.jpg" }) });

    expect(thumbResponse.status).toBe(200);
    expect(thumbResponse.headers.get("content-type")).toBe("image/jpeg");
    expect(await thumbResponse.text()).toBe("asset-thumb");
    expect(stockResponse.status).toBe(200);
    expect(await stockResponse.text()).toBe("stock-photo");
    expect(blocked.status).toBe(404);
  });

  it("serves valid uploaded maps and blocks missing/path traversal requests", async () => {
    const filename = "phase47-map.svg";
    await writeUploadFixture("uploads/maps", filename, "<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        warehouseMap: {
          findFirst: vi.fn(async ({ where }) =>
            where.uploadedStoredFilename === filename
              ? { uploadedStoredFilename: filename, uploadedMimeType: "image/svg+xml", uploadedOriginalFilename: "map.svg" }
              : null,
          ),
        },
      },
    }));
    const route = await import("../app/uploads/maps/[filename]/route");

    const ok = await route.GET(new Request("http://test/uploads/maps/phase47-map.svg"), { params: Promise.resolve({ filename }) });
    const missing = await route.GET(new Request("http://test/uploads/maps/missing.svg"), { params: Promise.resolve({ filename: "missing.svg" }) });
    const blocked = await route.GET(new Request("http://test/uploads/maps/../secret.svg"), { params: Promise.resolve({ filename: "../secret.svg" }) });

    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/svg+xml");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await ok.text()).toContain("<svg");
    expect(missing.status).toBe(404);
    expect(blocked.status).toBe(404);
  });
});

describe("photo primary behavior", () => {
  it("sets first photo as primary and respects explicit primary requests", () => {
    expect(shouldSetPrimaryPhoto(0, false)).toBe(true);
    expect(shouldSetPrimaryPhoto(2, false)).toBe(false);
    expect(shouldSetPrimaryPhoto(2, true)).toBe(true);
  });
});

async function writeUploadFixture(folder: string, filename: string, content: string) {
  const dir = path.join(process.cwd(), folder);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, content);
  createdUploadFiles.push(filePath);
  return filePath;
}

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

  it("hides archived or voided facturas by default", () => {
    expect(activeFacturaWhere(false)).toEqual({ status: "ACTIVE" });
    expect(activeFacturaWhere(true)).toEqual({});
  });

  it("blocks hard delete when a factura has links, files, or history", () => {
    const review = reviewFacturaHardDeleteSafety({
      filePath: "/uploads/facturas/test.pdf",
      _count: { assets: 1, stockItems: 0, stockMovements: 0, lineItems: 2, extractionAttempts: 1, tasks: 0, purchaseNotes: 0 },
    });

    expect(review.canHardDelete).toBe(false);
    expect(review.blockers.join(" ")).toContain("linked asset");
    expect(review.blockers.join(" ")).toContain("line item");
    expect(review.blockers.join(" ")).toContain("attached factura file");
  });

  it("allows hard delete review only when a factura is completely unlinked", () => {
    const review = reviewFacturaHardDeleteSafety({
      filePath: null,
      xmlPath: null,
      _count: { assets: 0, stockItems: 0, stockMovements: 0, lineItems: 0, extractionAttempts: 0, tasks: 0, purchaseNotes: 0 },
    });

    expect(review.canHardDelete).toBe(true);
    expect(review.blockers).toEqual([]);
  });
});
