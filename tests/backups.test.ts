import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BackupError, countFiles, createBackup, formatBackupFolderName, getBackupHistory, validateBackup } from "@/lib/backups";

const roots: string[] = [];

async function createRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "warehouse-backup-test-"));
  roots.push(root);
  return root;
}

async function writeProjectFile(root: string, relativePath: string, content: string) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("backup helpers", () => {
  it("creates stable manual backup folder names", () => {
    expect(formatBackupFolderName(new Date("2026-05-30T08:07:06"))).toBe("manual-20260530-080706");
  });

  it("creates a backup manifest and copies database plus upload folders", async () => {
    const root = await createRoot();
    await writeProjectFile(root, "prisma/dev.db", "sqlite-data");
    await writeProjectFile(root, "uploads/assets/a/photo.jpg", "asset-photo");
    await writeProjectFile(root, "uploads/assets/b/photo.jpg", "asset-photo-2");
    await writeProjectFile(root, "uploads/facturas/invoice.pdf", "factura-file");
    await writeProjectFile(root, "uploads/stock/item.jpg", "stock-photo");
    await writeProjectFile(root, "uploads/maps/warehouse.svg", "<svg />");

    const result = await createBackup({ projectRoot: root, now: new Date("2026-05-30T08:07:06") });
    const manifestPath = path.join(result.manifest.backupPath, "backup-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    expect(result.validation.valid).toBe(true);
    expect(manifest.databaseCopied).toBe(true);
    expect(manifest.uploadsAssetsFileCount).toBe(2);
    expect(manifest.uploadsFacturasFileCount).toBe(1);
    expect(manifest.uploadsStockFileCount).toBe(1);
    expect(manifest.uploadsMapsFileCount).toBe(1);
    expect(await countFiles(path.join(result.manifest.backupPath, "uploads", "assets"))).toBe(2);
    expect(await countFiles(path.join(result.manifest.backupPath, "uploads", "stock"))).toBe(1);
    expect(await countFiles(path.join(result.manifest.backupPath, "uploads", "maps"))).toBe(1);
  });

  it("handles missing optional upload folders with manifest warnings", async () => {
    const root = await createRoot();
    await writeProjectFile(root, "prisma/dev.db", "sqlite-data");

    const result = await createBackup({ projectRoot: root, now: new Date("2026-05-30T08:07:06") });

    expect(result.validation.valid).toBe(true);
    expect(result.manifest.uploadsAssetsCopied).toBe(false);
    expect(result.manifest.uploadsFacturasCopied).toBe(false);
    expect(result.manifest.uploadsStockCopied).toBe(false);
    expect(result.manifest.uploadsMapsCopied).toBe(false);
    expect(result.manifest.warnings).toHaveLength(4);
  });

  it("returns a clear error when the database is missing", async () => {
    const root = await createRoot();

    await expect(createBackup({ projectRoot: root })).rejects.toThrow(BackupError);
    await expect(createBackup({ projectRoot: root })).rejects.toThrow("Database file not found");
  });

  it("validates copied backup contents", async () => {
    const root = await createRoot();
    await mkdir(path.join(root, "backup", "prisma"), { recursive: true });
    await writeFile(path.join(root, "backup", "prisma", "dev.db"), "sqlite-data");
    await writeFile(path.join(root, "backup", "backup-manifest.json"), "{}");

    const validation = await validateBackup(path.join(root, "backup"));

    expect(validation.backupFolderExists).toBe(true);
    expect(validation.databaseSizeValid).toBe(true);
    expect(validation.manifestExists).toBe(true);
    expect(validation.valid).toBe(true);
  });

  it("lists backup history from manifests newest first", async () => {
    const root = await createRoot();
    await writeProjectFile(root, "prisma/dev.db", "sqlite-data");
    await createBackup({ projectRoot: root, now: new Date("2026-05-30T08:07:06Z") });
    await createBackup({ projectRoot: root, now: new Date("2026-05-31T08:07:06Z") });

    const history = await getBackupHistory({ projectRoot: root });

    expect(history).toHaveLength(2);
    expect(history[0].backupTimestamp).toBe("2026-05-31T08:07:06.000Z");
    expect(history[0].sizeBytes).toBeGreaterThan(0);
  });
});
