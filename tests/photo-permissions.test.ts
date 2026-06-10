import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("photo upload API permission contracts", () => {
  it("requires inventory write permission for asset photo upload and delete actions", async () => {
    const uploadRoute = await readFile(path.join(process.cwd(), "app/api/devices/[id]/photos/route.ts"), "utf8");
    const detailRoute = await readFile(path.join(process.cwd(), "app/api/devices/[id]/photos/[photoId]/route.ts"), "utf8");

    expect(uploadRoute).toContain('requirePermission("inventory.write")');
    expect(detailRoute).toContain('requirePermission("inventory.write")');
    expect(uploadRoute).toContain("validateUploadFile");
    expect(uploadRoute).toContain("generateThumbnailForUpload");
  });

  it("requires stock write permission for stock item photo upload", async () => {
    const stockRoute = await readFile(path.join(process.cwd(), "app/api/stock/[id]/photos/route.ts"), "utf8");

    expect(stockRoute).toContain('requirePermission("stock.write")');
    expect(stockRoute).toContain('kind: "stock-photo"');
    expect(stockRoute).toContain("generateThumbnailForUpload");
  });
});
