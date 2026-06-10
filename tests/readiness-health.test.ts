import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildHealthPayload } from "@/lib/health";
import { checkWritableDirectory, collectReadinessChecks, describeAppBaseUrl, isOneDrivePath, maskEnvValue } from "@/lib/readiness";

let tempRoot = "";

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "warehouse-readiness-test-"));
  await fs.mkdir(path.join(tempRoot, "prisma"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "prisma", "dev.db"), "sqlite-data");
  await fs.mkdir(path.join(tempRoot, "node_modules", ".prisma", "client"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, ".env"), "DATABASE_URL=file:./dev.db\nSMTP_PASS=secret\n");
  await fs.writeFile(
    path.join(tempRoot, "package.json"),
    JSON.stringify({
      name: "warehouse-test",
      version: "1.2.3",
      scripts: { backup: "tsx scripts/backup.ts", "jobs:run-due": "tsx scripts/run-due-jobs.ts", doctor: "tsx scripts/doctor.ts" },
    }),
  );
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("deployment readiness helpers", () => {
  it("masks sensitive environment values", () => {
    expect(maskEnvValue("SMTP_PASS", "super-secret")).toBe("set (masked)");
    expect(maskEnvValue("DATABASE_URL", "file:./dev.db")).toBe("set (masked)");
    expect(maskEnvValue("APP_BASE_URL", "http://localhost:3000")).toBe("http...00");
  });

  it("detects OneDrive runtime paths", () => {
    expect(isOneDrivePath("C:\\Users\\abastida\\OneDrive - TechStyle\\Documents\\New project 3")).toBe(true);
    expect(isOneDrivePath("C:\\Dev\\warehouse-it-inventory")).toBe(false);
  });

  it("describes APP_BASE_URL as localhost or LAN without exposing secrets", () => {
    expect(describeAppBaseUrl("http://localhost:3000")).toMatchObject({
      configured: true,
      scope: "localhost",
      suggestion: "For teammate/phone beta access, switch APP_BASE_URL to the reachable LAN IP or hostname.",
    });
    expect(describeAppBaseUrl("http://192.168.163.29:3000")).toMatchObject({
      configured: true,
      scope: "lan",
      suggestion: undefined,
    });
    expect(describeAppBaseUrl("not-a-url")).toMatchObject({ configured: true, scope: "invalid" });
  });

  it("creates and verifies writable upload folders", async () => {
    const result = await checkWritableDirectory(path.join(tempRoot, "uploads", "assets"), { createIfMissing: true });

    expect(result.exists).toBe(true);
    expect(result.created).toBe(true);
    expect(result.writable).toBe(true);
  });

  it("collects readiness checks and verifies package scripts include doctor", async () => {
    const result = await collectReadinessChecks({
      projectRoot: tempRoot,
      env: { DATABASE_URL: "file:./dev.db", SESSION_SECRET: "test-session-secret-at-least-32-chars", APP_BASE_URL: "http://localhost:3000", SMTP_HOST: "smtp.local", MAIL_FROM: "it@example.com" } as NodeJS.ProcessEnv,
      userCount: 1,
    });

    expect(result.checks.find((check) => check.name === "Backup command")).toMatchObject({ status: "PASS" });
    expect(result.checks.find((check) => check.name === "Scheduled jobs command")).toMatchObject({ status: "PASS" });
    expect(result.checks.find((check) => check.name === "Project path")).toMatchObject({ status: "PASS" });
    expect(result.checks.find((check) => check.name === "DATABASE_URL")?.message).not.toContain("file:./dev.db");
    expect(result.checks.find((check) => check.name === "SESSION_SECRET / AUTH_SECRET")).toMatchObject({ status: "PASS" });
    expect(result.checks.find((check) => check.name === "Application users")).toMatchObject({ status: "PASS" });
  });

  it("warns when the auth session secret is missing outside production", async () => {
    const result = await collectReadinessChecks({
      projectRoot: tempRoot,
      env: { DATABASE_URL: "file:./dev.db" } as NodeJS.ProcessEnv,
      userCount: 0,
    });

    expect(result.checks.find((check) => check.name === "SESSION_SECRET / AUTH_SECRET")).toMatchObject({ status: "WARN" });
    expect(result.checks.find((check) => check.name === "Application users")).toMatchObject({ status: "WARN" });
  });
});

describe("health payload", () => {
  it("returns operational status without secrets", async () => {
    const prisma = {
      $queryRaw: async () => [{ ok: 1 }],
      scheduledJob: { count: async () => 8 },
    };

    const payload = await buildHealthPayload(prisma as never, {
      projectRoot: tempRoot,
      env: {
        NODE_ENV: "test",
        DATABASE_URL: "file:./dev.db",
        SESSION_SECRET: "test-session-secret-at-least-32-chars",
        SMTP_HOST: "smtp.local",
        SMTP_PASS: "super-secret",
        MAIL_FROM: "it@example.com",
      } as NodeJS.ProcessEnv,
      now: new Date("2026-06-02T12:00:00.000Z"),
    });

    expect(payload.databaseReachable).toBe(true);
    expect(payload.uploadsAssetsWritable).toBe(true);
    expect(payload.uploadsFacturasWritable).toBe(true);
    expect(payload.backupsFolderWritable).toBe(true);
    expect(payload.emailConfigured).toBe(true);
    expect(payload.authSecretConfigured).toBe(true);
    expect(payload.scheduledJobsCount).toBe(8);
    expect(JSON.stringify(payload)).not.toContain("super-secret");
    expect(JSON.stringify(payload)).not.toContain("DATABASE_URL");
  });

  it("marks database failures as error", async () => {
    const prisma = {
      $queryRaw: async () => {
        throw new Error("db down");
      },
      scheduledJob: { count: async () => 0 },
    };

    const payload = await buildHealthPayload(prisma as never, { projectRoot: tempRoot, env: {} as NodeJS.ProcessEnv });

    expect(payload.status).toBe("error");
    expect(payload.databaseReachable).toBe(false);
    expect(payload.warnings).toContain("Database is not reachable.");
  });
});

describe("team beta ops artifacts", () => {
  const projectRoot = process.cwd();

  it("documents beta SMTP and APP_BASE_URL settings", async () => {
    const envExample = await fs.readFile(path.join(projectRoot, ".env.example"), "utf8");
    expect(envExample).toContain("SMTP_HOST=");
    expect(envExample).toContain("SMTP_PORT=");
    expect(envExample).toContain("SMTP_USER=");
    expect(envExample).toContain("SMTP_PASS=");
    expect(envExample).toContain("SMTP_FROM=");
    expect(envExample).toContain("MAIL_FROM=");
    expect(envExample).toContain("APP_BASE_URL=");
  });

  it("includes beta SOP and Windows helper scripts for the C:\\Dev runtime path", async () => {
    const sop = await fs.readFile(path.join(projectRoot, "docs", "BETA-SOP.md"), "utf8");
    const registerTask = await fs.readFile(path.join(projectRoot, "scripts", "register-jobs-task.ps1"), "utf8");
    const startProduction = await fs.readFile(path.join(projectRoot, "scripts", "start-production.ps1"), "utf8");

    expect(sop).toContain("Team Beta SOP");
    expect(sop).toContain("QA-SMOKE-001");
    expect(sop).toContain("npm run backup");
    expect(registerTask).toContain("Warehouse IT Inventory Jobs");
    expect(registerTask).toContain("C:\\Dev\\warehouse-it-inventory");
    expect(registerTask).toContain("jobs:run-due");
    expect(startProduction).toContain("C:\\Dev\\warehouse-it-inventory");
    expect(startProduction).toContain("npm.cmd run doctor");
    expect(startProduction).toContain("npm.cmd run start");
  });
});
