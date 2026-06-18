import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getMailConfig, getSanitizedMailStatus } from "@/lib/mail";
import { getAuthSecretStatus } from "@/lib/auth";
import { validateVaultSecret } from "@/lib/bitlocker-vault";

const execFileAsync = promisify(execFile);

export type ReadinessStatus = "PASS" | "WARN" | "FAIL";

export type ReadinessCheck = {
  name: string;
  status: ReadinessStatus;
  message: string;
  suggestion?: string;
};

export type WritableDirectoryResult = {
  exists: boolean;
  writable: boolean;
  created: boolean;
  path: string;
  error?: string;
};

export type MigrationMetadataReadiness = {
  migrationTableExists: boolean;
  appliedMigrationCount: number;
  error?: string;
};

const sensitiveNamePattern = /(PASS|PASSWORD|SECRET|TOKEN|KEY|SMTP_PASS|DATABASE_URL)/i;

export function maskEnvValue(name: string, value?: string | null) {
  if (!value) return "not set";
  if (sensitiveNamePattern.test(name)) return "set (masked)";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-2)}`;
}

export function isOneDrivePath(projectRoot: string) {
  return /\\OneDrive\b|\/OneDrive\b|OneDrive -|SharePoint/i.test(projectRoot);
}

export function summarizeReadiness(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (checks.some((check) => check.status === "WARN")) return "WARN";
  return "PASS";
}

export function describeAppBaseUrl(value?: string | null) {
  const cleanValue = value?.trim();
  if (!cleanValue) {
    return {
      configured: false,
      scope: "missing" as const,
      message: "APP_BASE_URL is not configured.",
      suggestion: "Set APP_BASE_URL for email links and production-like local runs.",
    };
  }

  try {
    const url = new URL(cleanValue);
    const host = url.hostname.toLowerCase();
    const localhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    const https = url.protocol === "https:";
    const httpLan = !localhost && url.protocol === "http:";
    return {
      configured: true,
      scope: localhost ? "localhost" as const : "lan" as const,
      https,
      httpLan,
      message: localhost
        ? `APP_BASE_URL is ${maskEnvValue("APP_BASE_URL", cleanValue)} (localhost/server-only).`
        : httpLan
          ? `APP_BASE_URL is ${maskEnvValue("APP_BASE_URL", cleanValue)} (plain HTTP LAN URL).`
          : `APP_BASE_URL is ${maskEnvValue("APP_BASE_URL", cleanValue)} (LAN/hostname candidate).`,
      suggestion: localhost
        ? "For teammate/phone beta access, switch APP_BASE_URL to the reachable LAN IP or hostname."
        : httpLan
          ? "Phone camera access and PWA install may require HTTPS/trusted origin; use Caddy or mkcert for LAN beta."
          : undefined,
    };
  } catch {
    return {
      configured: true,
      scope: "invalid" as const,
      message: `APP_BASE_URL is ${maskEnvValue("APP_BASE_URL", cleanValue)} but is not a valid URL.`,
      suggestion: "Use a full URL such as http://localhost:3000 or http://SERVER-IP:3000.",
    };
  }
}

export async function checkWritableDirectory(folderPath: string, options: { createIfMissing?: boolean } = {}): Promise<WritableDirectoryResult> {
  const resolved = path.resolve(folderPath);
  let created = false;
  try {
    const stat = await safeStat(resolved);
    if (!stat?.isDirectory()) {
      if (!options.createIfMissing) return { exists: false, writable: false, created, path: resolved, error: "Folder is missing." };
      await fs.mkdir(resolved, { recursive: true });
      created = true;
    }
    const probePath = path.join(resolved, `.readiness-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    await fs.writeFile(probePath, "ok", "utf8");
    await fs.unlink(probePath);
    return { exists: true, writable: true, created, path: resolved };
  } catch (error) {
    return {
      exists: true,
      writable: false,
      created,
      path: resolved,
      error: error instanceof Error ? error.message : "Directory is not writable.",
    };
  }
}

export async function collectReadinessChecks(options: { projectRoot?: string; env?: NodeJS.ProcessEnv; userCount?: number | null; migrationMetadata?: MigrationMetadataReadiness | null; bitLockerRecordCount?: number | null } = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const envPath = path.join(projectRoot, ".env");
  const env = options.env ?? { ...(await readDotEnv(envPath)), ...process.env };
  const checks: ReadinessCheck[] = [];

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "Node.js",
    status: nodeMajor >= 20 ? "PASS" : "WARN",
    message: `Node ${process.versions.node}`,
    suggestion: nodeMajor >= 20 ? undefined : "Use Node 20 or newer for this Next.js app.",
  });

  checks.push(await npmAvailabilityCheck());

  checks.push({
    name: "Project path",
    status: isOneDrivePath(projectRoot) ? "WARN" : "PASS",
    message: isOneDrivePath(projectRoot) ? "Project is inside OneDrive/SharePoint sync path." : "Project is outside OneDrive/SharePoint sync path.",
    suggestion: isOneDrivePath(projectRoot) ? "Recommended active runtime path: C:\\Dev\\warehouse-it-inventory." : undefined,
  });

  const envStat = await safeStat(envPath);
  checks.push({
    name: ".env",
    status: envStat?.isFile() ? "PASS" : "WARN",
    message: envStat?.isFile() ? ".env exists." : ".env is missing.",
    suggestion: envStat?.isFile() ? undefined : "Create .env from .env.example or copy the existing production/local .env.",
  });

  checks.push({
    name: "DATABASE_URL",
    status: env.DATABASE_URL ? "PASS" : "FAIL",
    message: `DATABASE_URL is ${maskEnvValue("DATABASE_URL", env.DATABASE_URL)}.`,
    suggestion: env.DATABASE_URL ? undefined : "Set DATABASE_URL, usually file:./dev.db for the local SQLite database.",
  });

  const authSecret = getAuthSecretStatus(env);
  checks.push({
    name: "SESSION_SECRET / AUTH_SECRET",
    status: authSecret.configured ? "PASS" : authSecret.productionLike ? "FAIL" : "WARN",
    message: authSecret.configured
      ? "Auth session secret is configured."
      : authSecret.tooShort
        ? "Auth session secret is set but must be at least 32 characters."
        : "Auth session secret is not configured.",
    suggestion: authSecret.configured ? undefined : "Set SESSION_SECRET or AUTH_SECRET to a random value of at least 32 characters before relying on login sessions.",
  });

  const bitLockerSecret = validateVaultSecret(env);
  checks.push({
    name: "BITLOCKER_VAULT_SECRET",
    status: bitLockerSecret.usable ? "PASS" : "WARN",
    message: bitLockerSecret.usable
      ? "BitLocker vault secret is configured."
      : bitLockerSecret.tooShort
        ? `BitLocker vault secret is set but must be at least ${bitLockerSecret.minLength} characters.`
        : "BitLocker vault secret is not configured.",
    suggestion: bitLockerSecret.usable
      ? undefined
      : "Set BITLOCKER_VAULT_SECRET to a company-managed random secret before creating or revealing recovery keys.",
  });

  if (options.bitLockerRecordCount !== undefined) {
    checks.push({
      name: "BitLocker vault records",
      status: options.bitLockerRecordCount && options.bitLockerRecordCount > 0 && !bitLockerSecret.usable ? "WARN" : "PASS",
      message: options.bitLockerRecordCount == null ? "BitLocker vault record count could not be checked." : `${options.bitLockerRecordCount} protected recovery-key record${options.bitLockerRecordCount === 1 ? "" : "s"} found.`,
      suggestion: options.bitLockerRecordCount && options.bitLockerRecordCount > 0 && !bitLockerSecret.usable ? "Restore or configure the same BITLOCKER_VAULT_SECRET used when keys were encrypted." : undefined,
    });
  }

  if (options.userCount !== undefined) {
    checks.push({
      name: "Application users",
      status: options.userCount && options.userCount > 0 ? "PASS" : "WARN",
      message: options.userCount == null ? "User count could not be checked." : `${options.userCount} active/user record${options.userCount === 1 ? "" : "s"} found.`,
      suggestion: options.userCount && options.userCount > 0 ? undefined : "Create the first admin at /setup-admin before relying on authenticated workflows.",
    });
  }

  const dbPath = path.join(projectRoot, "prisma", "dev.db");
  const dbStat = await safeStat(dbPath);
  checks.push({
    name: "SQLite database",
    status: dbStat?.isFile() && dbStat.size > 0 ? "PASS" : "FAIL",
    message: dbStat?.isFile() ? `prisma/dev.db exists (${dbStat.size} bytes).` : "prisma/dev.db is missing.",
    suggestion: dbStat?.isFile() && dbStat.size > 0 ? undefined : "Restore from backup or run the appropriate Prisma migration/setup for a new database.",
  });

  const prismaClientPath = path.join(projectRoot, "node_modules", ".prisma", "client");
  checks.push({
    name: "Prisma client",
    status: (await safeStat(prismaClientPath))?.isDirectory() ? "PASS" : "WARN",
    message: (await safeStat(prismaClientPath))?.isDirectory() ? "Prisma client appears generated." : "Prisma client folder was not found.",
    suggestion: (await safeStat(prismaClientPath))?.isDirectory() ? undefined : "Run npx prisma generate.",
  });

  if (options.migrationMetadata !== undefined) {
    const metadata = options.migrationMetadata;
    checks.push({
      name: "Prisma migration baseline",
      status: metadata?.migrationTableExists && metadata.appliedMigrationCount > 0 ? "PASS" : "WARN",
      message: metadata?.error
        ? `Migration metadata could not be checked: ${metadata.error}`
        : metadata?.migrationTableExists
          ? `${metadata.appliedMigrationCount} migration record${metadata.appliedMigrationCount === 1 ? "" : "s"} found.`
          : "Prisma migration metadata table is missing on the existing database.",
      suggestion:
        metadata?.migrationTableExists && metadata.appliedMigrationCount > 0
          ? undefined
          : "Run npm run db:baseline:dry-run, back up the DB, then baseline with explicit confirmation before relying on migrate deploy.",
    });
  }

  for (const [name, relativePath] of [
    ["Asset uploads", path.join("uploads", "assets")],
    ["Factura uploads", path.join("uploads", "facturas")],
    ["Map uploads", path.join("uploads", "maps")],
    ["Backups folder", "backups"],
  ] as const) {
    const result = await checkWritableDirectory(path.join(projectRoot, relativePath), { createIfMissing: true });
    checks.push({
      name,
      status: result.writable ? result.created ? "WARN" : "PASS" : "FAIL",
      message: result.writable ? `${relativePath} is writable${result.created ? " and was created." : "."}` : `${relativePath} is not writable: ${result.error ?? "unknown error"}`,
      suggestion: result.writable ? undefined : `Check Windows permissions or create ${relativePath} manually.`,
    });
  }

  const mailConfig = getMailConfig(env);
  const mailStatus = getSanitizedMailStatus(env);
  checks.push({
    name: "SMTP email",
    status: mailConfig.configured && !mailStatus.authPartial ? "PASS" : "WARN",
    message: mailConfig.configured
      ? `SMTP configured. host=${mailStatus.hostPresent ? "present" : "missing"}, from=${mailStatus.fromPresent ? "present" : "missing"}, port=${mailStatus.port}, secure=${mailStatus.secure ? "yes" : "no"}, auth=${mailStatus.authPresent ? "present" : mailStatus.authPartial ? "partial" : "not set"}.`
      : `Email is not configured. Missing ${mailConfig.missing.join(", ") || "SMTP settings"}.`,
    suggestion: mailConfig.configured
      ? mailStatus.authPartial
        ? "Set both SMTP_USER and SMTP_PASS, or leave both blank for an internal relay."
        : undefined
      : "Manual workflows still save records; configure SMTP only when receipts/reminders should send.",
  });

  const appBaseUrl = describeAppBaseUrl(env.APP_BASE_URL);
  checks.push({
    name: "APP_BASE_URL",
    status: appBaseUrl.configured && appBaseUrl.scope !== "invalid" && !("httpLan" in appBaseUrl && appBaseUrl.httpLan) ? "PASS" : "WARN",
    message: appBaseUrl.message,
    suggestion: appBaseUrl.suggestion,
  });

  checks.push(await packageScriptCheck(projectRoot, "jobs:run-due", "Scheduled jobs command", "Keep npm run jobs:run-due available for Windows Task Scheduler."));
  checks.push(await packageScriptCheck(projectRoot, "backup", "Backup command", "Keep npm run backup available before imports/migrations."));

  return { projectRoot, status: summarizeReadiness(checks), checks };
}

export async function getPackageInfo(projectRoot = process.cwd()) {
  try {
    const raw = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
    return JSON.parse(raw) as { name?: string; version?: string; scripts?: Record<string, string> };
  } catch {
    return {};
  }
}

async function packageScriptCheck(projectRoot: string, scriptName: string, name: string, suggestion: string): Promise<ReadinessCheck> {
  const info = await getPackageInfo(projectRoot);
  return {
    name,
    status: info.scripts?.[scriptName] ? "PASS" : "FAIL",
    message: info.scripts?.[scriptName] ? `npm run ${scriptName} is available.` : `npm run ${scriptName} is missing.`,
    suggestion: info.scripts?.[scriptName] ? undefined : suggestion,
  };
}

async function commandCheck(command: string, args: string[], name: string, suggestion: string): Promise<ReadinessCheck> {
  try {
    const { stdout } = await execFileAsync(command, args, { windowsHide: true, timeout: 10000 });
    return { name, status: "PASS", message: `${name} ${stdout.trim()}` };
  } catch {
    return { name, status: "FAIL", message: `${name} command is not available.`, suggestion };
  }
}

async function npmAvailabilityCheck(): Promise<ReadinessCheck> {
  if (process.env.npm_execpath || process.env.npm_config_user_agent) {
    const version = process.env.npm_config_user_agent?.match(/npm\/([^\s]+)/)?.[1];
    return { name: "npm", status: "PASS", message: `npm is available${version ? ` (${version})` : ""}.` };
  }
  return commandCheck(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], "npm", "Install Node.js/npm and make sure npm.cmd is on PATH.");
}

async function readDotEnv(envPath: string) {
  try {
    const raw = await fs.readFile(envPath, "utf8");
    const values: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      values[key] = value.trim().replace(/^['"]|['"]$/g, "");
    }
    return values;
  } catch {
    return {};
  }
}

async function safeStat(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

export function formatDoctorChecks(checks: ReadinessCheck[]) {
  return checks
    .map((check) => {
      const suggestion = check.suggestion ? `\n      Fix: ${check.suggestion}` : "";
      return `[${check.status}] ${check.name}: ${check.message}${suggestion}`;
    })
    .join(os.EOL);
}
