import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { AppRole, DeviceCategory } from "@prisma/client";
import { ClientInputError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

const payloadVersion = "v1";
const secretMinLength = 32;
const recoveryKeyPattern = /^\d{6}(?:-\d{6}){7}$/;
const eligibleCategories = new Set<DeviceCategory | string>(["LAPTOP", "DESKTOP"]);

export type BitLockerVaultSecretStatus = {
  configured: boolean;
  tooShort: boolean;
  usable: boolean;
  minLength: number;
};

export function validateVaultSecret(env: NodeJS.ProcessEnv = process.env): BitLockerVaultSecretStatus {
  const secret = env.BITLOCKER_VAULT_SECRET?.trim() ?? "";
  return {
    configured: Boolean(secret),
    tooShort: Boolean(secret && secret.length < secretMinLength),
    usable: Boolean(secret && secret.length >= secretMinLength),
    minLength: secretMinLength,
  };
}

export function requireVaultSecret(env: NodeJS.ProcessEnv = process.env) {
  const status = validateVaultSecret(env);
  if (!status.usable) {
    throw new ClientInputError(`BitLocker vault secret is not configured. Set BITLOCKER_VAULT_SECRET to at least ${secretMinLength} characters before creating or revealing recovery keys.`, 422);
  }
  return env.BITLOCKER_VAULT_SECRET!.trim();
}

export function encryptRecoveryKey(recoveryKey: string, secret = requireVaultSecret()) {
  const normalized = normalizeRecoveryKey(recoveryKey);
  if (!validateRecoveryKeyFormat(normalized)) throw new ClientInputError("Enter a valid BitLocker recovery key: 8 groups of 6 digits.", 422);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(secret), iv);
  cipher.setAAD(Buffer.from("warehouse-bitlocker-vault", "utf8"));
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [payloadVersion, iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(":");
}

export function decryptRecoveryKey(payload: string, secret = requireVaultSecret()) {
  const [version, ivText, ciphertextText, tagText] = payload.split(":");
  if (version !== payloadVersion || !ivText || !ciphertextText || !tagText) throw new ClientInputError("Stored BitLocker key payload is invalid.", 422);
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey(secret), Buffer.from(ivText, "base64url"));
    decipher.setAAD(Buffer.from("warehouse-bitlocker-vault", "utf8"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new ClientInputError("BitLocker recovery key could not be decrypted. Check BITLOCKER_VAULT_SECRET.", 422);
  }
}

export function normalizeRecoveryKey(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 48) return digits.match(/.{1,6}/g)?.join("-") ?? value.trim();
  return value.trim().replace(/\s+/g, "-").replace(/-+/g, "-").toUpperCase();
}

export function validateRecoveryKeyFormat(value: string) {
  return recoveryKeyPattern.test(normalizeRecoveryKey(value));
}

export function redactRecoveryKey(value?: string | null) {
  if (!value) return "No key";
  const normalized = normalizeRecoveryKey(value);
  const lastGroup = normalized.split("-").at(-1) ?? "******";
  return `******-******-******-******-******-******-******-${lastGroup}`;
}

export function encryptedPayloadContainsPlaintext(payload: string, recoveryKey: string) {
  const normalized = normalizeRecoveryKey(recoveryKey);
  return payload.includes(normalized) || payload.includes(normalized.replaceAll("-", ""));
}

export function canRevealBitLockerKey(user: Pick<AuthUser, "role" | "isActive"> | null | undefined) {
  return Boolean(user?.isActive && user.role === "ADMIN");
}

export function canManageBitLockerKey(user: Pick<AuthUser, "role" | "isActive"> | null | undefined) {
  return Boolean(user?.isActive && (user.role === "ADMIN" || user.role === "IT_STAFF"));
}

export function canViewBitLockerSummary(user: Pick<AuthUser, "role" | "isActive"> | null | undefined) {
  return Boolean(user?.isActive && ["ADMIN", "IT_STAFF", "AUDITOR", "VIEWER"].includes(user.role as AppRole));
}

export function isBitLockerEligibleCategory(category: DeviceCategory | string) {
  return eligibleCategories.has(category);
}

export function sanitizeBitLockerRecord(record?: BitLockerSummaryRecord | null, options: { includeRestrictedMetadata?: boolean } = {}) {
  if (!record) return null;
  if (!options.includeRestrictedMetadata) {
    return {
      exists: true,
      id: record.id,
      updatedAt: record.updatedAt,
      lastViewedAt: record.lastViewedAt,
    };
  }
  return {
    exists: true,
    id: record.id,
    keyId: record.keyId,
    volumeLabel: record.volumeLabel,
    protectorId: record.protectorId,
    source: record.source,
    notes: record.notes,
    createdByName: record.createdByName,
    updatedByName: record.updatedByName,
    lastViewedAt: record.lastViewedAt,
    lastViewedByName: record.lastViewedByName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export type BitLockerSummaryRecord = {
  id: string;
  keyId: string | null;
  volumeLabel: string | null;
  protectorId: string | null;
  source: string;
  notes: string | null;
  createdByName: string;
  updatedByName: string | null;
  lastViewedAt: Date | string | null;
  lastViewedByName: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function secretKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}
