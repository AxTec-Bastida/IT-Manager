import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientInputError } from "@/lib/api";
import {
  canManageBitLockerKey,
  canRevealBitLockerKey,
  decryptRecoveryKey,
  encryptedPayloadContainsPlaintext,
  encryptRecoveryKey,
  normalizeRecoveryKey,
  redactRecoveryKey,
  requireVaultSecret,
  validateRecoveryKeyFormat,
  validateVaultSecret,
} from "@/lib/bitlocker-vault";
import { collectReadinessChecks } from "@/lib/readiness";

const qaKey = "111111-222222-333333-444444-555555-666666-777777-888888";
const secret = "phase67-test-secret-at-least-32-characters";

describe("BitLocker vault helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BITLOCKER_VAULT_SECRET;
  });

  it("normalizes, validates, and redacts recovery keys", () => {
    expect(normalizeRecoveryKey("111111 222222 333333 444444 555555 666666 777777 888888")).toBe(qaKey);
    expect(validateRecoveryKeyFormat(qaKey)).toBe(true);
    expect(validateRecoveryKeyFormat("not-a-key")).toBe(false);
    expect(redactRecoveryKey(qaKey)).toBe("******-******-******-******-******-******-******-888888");
  });

  it("encrypts and decrypts without storing plaintext", () => {
    const encrypted = encryptRecoveryKey(qaKey, secret);

    expect(encrypted).toMatch(/^v1:/);
    expect(encryptedPayloadContainsPlaintext(encrypted, qaKey)).toBe(false);
    expect(decryptRecoveryKey(encrypted, secret)).toBe(qaKey);
    expect(() => decryptRecoveryKey(encrypted, "wrong-secret-at-least-32-characters")).toThrow(ClientInputError);
  });

  it("requires a configured vault secret for protected operations", () => {
    expect(validateVaultSecret({ BITLOCKER_VAULT_SECRET: "" } as NodeJS.ProcessEnv)).toMatchObject({ configured: false, usable: false });
    expect(validateVaultSecret({ BITLOCKER_VAULT_SECRET: "short" } as NodeJS.ProcessEnv)).toMatchObject({ configured: true, tooShort: true, usable: false });
    expect(() => requireVaultSecret({ BITLOCKER_VAULT_SECRET: "" } as NodeJS.ProcessEnv)).toThrow(/BITLOCKER_VAULT_SECRET/);
  });

  it("keeps reveal permission admin-only while allowing IT staff metadata management", () => {
    expect(canRevealBitLockerKey({ role: "ADMIN", isActive: true })).toBe(true);
    expect(canRevealBitLockerKey({ role: "IT_STAFF", isActive: true })).toBe(false);
    expect(canRevealBitLockerKey({ role: "VIEWER", isActive: true })).toBe(false);
    expect(canManageBitLockerKey({ role: "IT_STAFF", isActive: true })).toBe(true);
    expect(canManageBitLockerKey({ role: "AUDITOR", isActive: true })).toBe(false);
  });

  it("exposes doctor/readiness warnings without printing the secret", async () => {
    const result = await collectReadinessChecks({
      projectRoot: process.cwd(),
      env: { DATABASE_URL: "file:./dev.db", SESSION_SECRET: secret, BITLOCKER_VAULT_SECRET: "short" } as NodeJS.ProcessEnv,
      userCount: 1,
      bitLockerRecordCount: 1,
    });
    const bitLockerCheck = result.checks.find((check) => check.name === "BITLOCKER_VAULT_SECRET");

    expect(bitLockerCheck).toMatchObject({ status: "WARN" });
    expect(JSON.stringify(result.checks)).not.toContain(secret);
  });

  it("documents the vault secret and keeps reports/exports free of recovery key fields", async () => {
    const envExample = await fs.readFile(path.join(process.cwd(), ".env.example"), "utf8");
    const exportRoute = await fs.readFile(path.join(process.cwd(), "app", "api", "export", "[type]", "route.ts"), "utf8");
    const reports = await fs.readFile(path.join(process.cwd(), "lib", "reports.ts"), "utf8");

    expect(envExample).toContain("BITLOCKER_VAULT_SECRET=");
    expect(exportRoute).not.toMatch(/recoveryKey|bitLocker/i);
    expect(reports).not.toMatch(/recoveryKey|bitLockerRecoveryKey/i);
  });
});
