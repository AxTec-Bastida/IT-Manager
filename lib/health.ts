import path from "node:path";
import { promises as fs } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { getBackupHistory } from "@/lib/backups";
import { getMailConfig } from "@/lib/mail";
import { getAuthSecretStatus } from "@/lib/auth";

export type HealthStatus = "ok" | "degraded" | "error";

export type HealthPayload = {
  status: HealthStatus;
  app: {
    name: string;
    version: string;
  };
  databaseReachable: boolean;
  backupsFolderWritable: boolean;
  uploadsAssetsWritable: boolean;
  uploadsFacturasWritable: boolean;
  emailConfigured: boolean;
  authSecretConfigured: boolean;
  currentTime: string;
  environment: string;
  scheduledJobsCount: number | null;
  lastSuccessfulBackup: { timestamp: string; status: string } | null;
  warnings: string[];
};

export async function buildHealthPayload(
  prisma: Pick<PrismaClient, "$queryRaw" | "scheduledJob">,
  options: { projectRoot?: string; env?: NodeJS.ProcessEnv; now?: Date } = {},
): Promise<HealthPayload> {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : path.resolve(/* turbopackIgnore: true */ process.cwd());
  const env = options.env ?? process.env;
  const warnings: string[] = [];

  let databaseReachable = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch {
    warnings.push("Database is not reachable.");
  }

  const [assetsWritable, facturasWritable, backupsWritable, backups] = await Promise.all([
    checkHealthWritableDirectory(path.join(projectRoot, "uploads", "assets")),
    checkHealthWritableDirectory(path.join(projectRoot, "uploads", "facturas")),
    checkHealthWritableDirectory(path.join(projectRoot, "backups")),
    getBackupHistory({ projectRoot }).catch(() => []),
  ]);

  if (!assetsWritable.writable) warnings.push("uploads/assets is not writable.");
  if (!facturasWritable.writable) warnings.push("uploads/facturas is not writable.");
  if (!backupsWritable.writable) warnings.push("backups folder is not writable.");

  let scheduledJobsCount: number | null = null;
  try {
    scheduledJobsCount = await prisma.scheduledJob.count();
  } catch {
    warnings.push("Scheduled jobs count could not be read.");
  }

  const latestSuccessfulBackup = backups.find((backup) => backup.status === "SUCCESS") ?? null;
  const emailConfigured = getMailConfig(env).configured;
  if (!emailConfigured) warnings.push("SMTP email is not configured.");
  const authSecret = getAuthSecretStatus(env);
  if (!authSecret.configured) warnings.push(authSecret.productionLike ? "Auth session secret is not configured." : "Auth session secret is not configured; development fallback is active.");

  const status: HealthStatus = !databaseReachable
    ? "error"
    : warnings.some((warning) => warning.includes("not writable") || warning.includes("could not be read"))
      ? "degraded"
      : warnings.length
        ? "degraded"
        : "ok";

  return {
    status,
    app: {
      name: "ipam-app",
      version: "0.1.0",
    },
    databaseReachable,
    backupsFolderWritable: backupsWritable.writable,
    uploadsAssetsWritable: assetsWritable.writable,
    uploadsFacturasWritable: facturasWritable.writable,
    emailConfigured,
    authSecretConfigured: authSecret.configured,
    currentTime: (options.now ?? new Date()).toISOString(),
    environment: env.NODE_ENV || "development",
    scheduledJobsCount,
    lastSuccessfulBackup: latestSuccessfulBackup ? { timestamp: latestSuccessfulBackup.backupTimestamp, status: latestSuccessfulBackup.status } : null,
    warnings,
  };
}

async function checkHealthWritableDirectory(folderPath: string) {
  try {
    await fs.mkdir(folderPath, { recursive: true });
    const probePath = path.join(folderPath, `.health-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    await fs.writeFile(probePath, "ok", "utf8");
    await fs.unlink(probePath);
    return { writable: true };
  } catch {
    return { writable: false };
  }
}
