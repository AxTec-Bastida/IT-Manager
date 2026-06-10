import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const appName = "ipam-app";
const appVersion = "0.1.0";

export type BackupStatus = "SUCCESS" | "FAILED";

export type BackupManifest = {
  backupTimestamp: string;
  appName: string;
  appVersion: string;
  gitCommitHash: string | null;
  status: BackupStatus;
  backupPath: string;
  databasePath: string;
  databaseCopied: boolean;
  databaseFileSize: number;
  uploadsAssetsCopied: boolean;
  uploadsAssetsFileCount: number;
  uploadsFacturasCopied: boolean;
  uploadsFacturasFileCount: number;
  uploadsStockCopied?: boolean;
  uploadsStockFileCount?: number;
  uploadsMapsCopied?: boolean;
  uploadsMapsFileCount?: number;
  warnings: string[];
  createdAt: string;
};

export type BackupValidationSummary = {
  backupFolderExists: boolean;
  databaseExists: boolean;
  databaseSizeValid: boolean;
  manifestExists: boolean;
  assetsFolderCopied: boolean;
  facturasFolderCopied: boolean;
  stockFolderCopied: boolean;
  mapsFolderCopied: boolean;
  valid: boolean;
  warnings: string[];
};

export type BackupResult = {
  manifest: BackupManifest;
  validation: BackupValidationSummary;
};

export type BackupOptions = {
  projectRoot?: string;
  backupBaseDir?: string;
  now?: Date;
};

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export function formatBackupFolderName(now = new Date(), prefix = "manual") {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${prefix}-${stamp}`;
}

export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const backupBaseDir = resolveBackupBaseDir(projectRoot, options.backupBaseDir);
  const now = options.now ?? new Date();
  const backupDir = path.join(backupBaseDir, formatBackupFolderName(now));
  const warnings: string[] = [];
  const databaseSource = path.join(projectRoot, "prisma", "dev.db");
  const databaseDestination = path.join(backupDir, "prisma", "dev.db");
  const assetsSource = path.join(projectRoot, "uploads", "assets");
  const facturasSource = path.join(projectRoot, "uploads", "facturas");
  const stockSource = path.join(projectRoot, "uploads", "stock");
  const mapsSource = path.join(projectRoot, "uploads", "maps");
  const assetsDestination = path.join(backupDir, "uploads", "assets");
  const facturasDestination = path.join(backupDir, "uploads", "facturas");
  const stockDestination = path.join(backupDir, "uploads", "stock");
  const mapsDestination = path.join(backupDir, "uploads", "maps");

  const databaseStat = await statIfExists(databaseSource);
  if (!databaseStat?.isFile()) {
    throw new BackupError(`Database file not found at ${databaseSource}. Backup was not created.`);
  }
  if (databaseStat.size <= 0) {
    throw new BackupError(`Database file at ${databaseSource} is empty. Backup was not created.`);
  }

  await fs.mkdir(path.dirname(databaseDestination), { recursive: true });
  await fs.copyFile(databaseSource, databaseDestination);

  const assetsStat = await statIfExists(assetsSource);
  let assetsCount = 0;
  let assetsCopied = false;
  if (assetsStat?.isDirectory()) {
    await fs.mkdir(path.dirname(assetsDestination), { recursive: true });
    await fs.cp(assetsSource, assetsDestination, { recursive: true });
    assetsCount = await countFiles(assetsDestination);
    assetsCopied = true;
  } else {
    warnings.push(`uploads/assets was not found at ${assetsSource}.`);
  }

  const facturasStat = await statIfExists(facturasSource);
  let facturasCount = 0;
  let facturasCopied = false;
  if (facturasStat?.isDirectory()) {
    await fs.mkdir(path.dirname(facturasDestination), { recursive: true });
    await fs.cp(facturasSource, facturasDestination, { recursive: true });
    facturasCount = await countFiles(facturasDestination);
    facturasCopied = true;
  } else {
    warnings.push(`uploads/facturas was not found at ${facturasSource}.`);
  }

  const stockStat = await statIfExists(stockSource);
  let stockCount = 0;
  let stockCopied = false;
  if (stockStat?.isDirectory()) {
    await fs.mkdir(path.dirname(stockDestination), { recursive: true });
    await fs.cp(stockSource, stockDestination, { recursive: true });
    stockCount = await countFiles(stockDestination);
    stockCopied = true;
  } else {
    warnings.push(`uploads/stock was not found at ${stockSource}.`);
  }

  const mapsStat = await statIfExists(mapsSource);
  let mapsCount = 0;
  let mapsCopied = false;
  if (mapsStat?.isDirectory()) {
    await fs.mkdir(path.dirname(mapsDestination), { recursive: true });
    await fs.cp(mapsSource, mapsDestination, { recursive: true });
    mapsCount = await countFiles(mapsDestination);
    mapsCopied = true;
  } else {
    warnings.push(`uploads/maps was not found at ${mapsSource}.`);
  }

  const manifest: BackupManifest = {
    backupTimestamp: now.toISOString(),
    appName,
    appVersion,
    gitCommitHash: await getGitCommitHash(projectRoot),
    status: "SUCCESS",
    backupPath: backupDir,
    databasePath: databaseSource,
    databaseCopied: true,
    databaseFileSize: databaseStat.size,
    uploadsAssetsCopied: assetsCopied,
    uploadsAssetsFileCount: assetsCount,
    uploadsFacturasCopied: facturasCopied,
    uploadsFacturasFileCount: facturasCount,
    uploadsStockCopied: stockCopied,
    uploadsStockFileCount: stockCount,
    uploadsMapsCopied: mapsCopied,
    uploadsMapsFileCount: mapsCount,
    warnings,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(backupDir, "backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const validation = await validateBackup(backupDir, {
    expectedAssetsFolder: assetsCopied,
    expectedFacturasFolder: facturasCopied,
    expectedStockFolder: stockCopied,
    expectedMapsFolder: mapsCopied,
  });
  return { manifest: { ...manifest, status: validation.valid ? "SUCCESS" : "FAILED" }, validation };
}

export async function validateBackup(
  backupDir: string,
  options: { expectedAssetsFolder?: boolean; expectedFacturasFolder?: boolean; expectedStockFolder?: boolean; expectedMapsFolder?: boolean } = {},
): Promise<BackupValidationSummary> {
  const warnings: string[] = [];
  const folderStat = await statIfExists(backupDir);
  const dbStat = await statIfExists(path.join(backupDir, "prisma", "dev.db"));
  const manifestStat = await statIfExists(path.join(backupDir, "backup-manifest.json"));
  const assetsStat = await statIfExists(path.join(backupDir, "uploads", "assets"));
  const facturasStat = await statIfExists(path.join(backupDir, "uploads", "facturas"));
  const stockStat = await statIfExists(path.join(backupDir, "uploads", "stock"));
  const mapsStat = await statIfExists(path.join(backupDir, "uploads", "maps"));
  const backupFolderExists = Boolean(folderStat?.isDirectory());
  const databaseExists = Boolean(dbStat?.isFile());
  const databaseSizeValid = Boolean(dbStat && dbStat.size > 0);
  const manifestExists = Boolean(manifestStat?.isFile());
  const assetsFolderCopied = Boolean(assetsStat?.isDirectory());
  const facturasFolderCopied = Boolean(facturasStat?.isDirectory());
  const stockFolderCopied = Boolean(stockStat?.isDirectory());
  const mapsFolderCopied = Boolean(mapsStat?.isDirectory());

  if (!backupFolderExists) warnings.push("Backup folder does not exist.");
  if (!databaseExists) warnings.push("Copied prisma/dev.db is missing.");
  if (databaseExists && !databaseSizeValid) warnings.push("Copied prisma/dev.db is empty.");
  if (!manifestExists) warnings.push("backup-manifest.json is missing.");
  if (options.expectedAssetsFolder && !assetsFolderCopied) warnings.push("uploads/assets was expected but was not copied.");
  if (options.expectedFacturasFolder && !facturasFolderCopied) warnings.push("uploads/facturas was expected but was not copied.");
  if (options.expectedStockFolder && !stockFolderCopied) warnings.push("uploads/stock was expected but was not copied.");
  if (options.expectedMapsFolder && !mapsFolderCopied) warnings.push("uploads/maps was expected but was not copied.");

  return {
    backupFolderExists,
    databaseExists,
    databaseSizeValid,
    manifestExists,
    assetsFolderCopied,
    facturasFolderCopied,
    stockFolderCopied,
    mapsFolderCopied,
    valid:
      backupFolderExists &&
      databaseExists &&
      databaseSizeValid &&
      manifestExists &&
      (!options.expectedAssetsFolder || assetsFolderCopied) &&
      (!options.expectedFacturasFolder || facturasFolderCopied) &&
      (!options.expectedStockFolder || stockFolderCopied) &&
      (!options.expectedMapsFolder || mapsFolderCopied),
    warnings,
  };
}

export async function getBackupHistory(options: BackupOptions = {}) {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const backupBaseDir = resolveBackupBaseDir(projectRoot, options.backupBaseDir);
  const entries = await safeReadDir(backupBaseDir);
  const manifests = await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return null;
      const backupPath = path.join(backupBaseDir, entry.name);
      const manifest = await readBackupManifest(path.join(backupPath, "backup-manifest.json"));
      if (!manifest) return null;
      const sizeBytes = await directorySize(backupPath);
      return { ...manifest, backupPath, sizeBytes };
    }),
  );
  return manifests
    .filter((item): item is BackupManifest & { sizeBytes: number } => Boolean(item))
    .sort((a, b) => b.backupTimestamp.localeCompare(a.backupTimestamp));
}

export async function countFiles(folderPath: string): Promise<number> {
  const entries = await safeReadDir(folderPath);
  let count = 0;
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) count += await countFiles(fullPath);
    if (entry.isFile()) count += 1;
  }
  return count;
}

async function directorySize(folderPath: string): Promise<number> {
  const entries = await safeReadDir(folderPath);
  let size = 0;
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) size += await directorySize(fullPath);
    if (entry.isFile()) size += (await fs.stat(fullPath)).size;
  }
  return size;
}

async function readBackupManifest(manifestPath: string): Promise<BackupManifest | null> {
  try {
    return JSON.parse(await fs.readFile(manifestPath, "utf8")) as BackupManifest;
  } catch {
    return null;
  }
}

async function safeReadDir(folderPath: string) {
  try {
    return await fs.readdir(folderPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function statIfExists(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function getGitCommitHash(projectRoot: string) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, windowsHide: true });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function resolveProjectRoot(projectRoot?: string) {
  return projectRoot ? path.resolve(projectRoot) : /* turbopackIgnore: true */ process.cwd();
}

function resolveBackupBaseDir(projectRoot: string, backupBaseDir?: string) {
  const configuredDir = backupBaseDir ?? process.env.BACKUP_DIR;
  return configuredDir ? path.resolve(projectRoot, configuredDir) : path.join(projectRoot, "backups");
}
