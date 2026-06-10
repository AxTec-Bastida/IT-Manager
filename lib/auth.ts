import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import type { AppRole, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuthRequiredError, ForbiddenError } from "@/lib/auth-errors";

const scrypt = promisify(scryptCallback);

export const sessionCookieName = "warehouse_session";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 7;
const passwordKeyLength = 64;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: AppRole;
  isActive: boolean;
};

export type PermissionAction =
  | "inventory.read"
  | "inventory.write"
  | "assignments.write"
  | "loans.write"
  | "stock.write"
  | "rma.write"
  | "audits.read"
  | "audits.write"
  | "tasks.read"
  | "tasks.write"
  | "labels.print"
  | "labels.manage"
  | "dataQuality.cleanup"
  | "settings.manage"
  | "backups.manage"
  | "jobs.manage"
  | "imports.manage"
  | "users.manage"
  | "admin.manage";

export { AuthRequiredError, ForbiddenError };

export function getAuthSecretStatus(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.SESSION_SECRET || env.AUTH_SECRET;
  const configured = Boolean(secret && secret.length >= 32);
  const missing = !secret;
  const tooShort = Boolean(secret && secret.length < 32);
  const productionLike = env.NODE_ENV === "production";
  return {
    configured,
    missing,
    tooShort,
    productionLike,
    usable: configured || !productionLike,
    secret: configured ? secret! : "dev-only-insecure-session-secret-change-me",
  };
}

export function validatePasswordStrength(password: string) {
  const issues: string[] = [];
  if (password.length < 10) issues.push("Use at least 10 characters.");
  if (!/[a-z]/.test(password)) issues.push("Add a lowercase letter.");
  if (!/[A-Z]/.test(password)) issues.push("Add an uppercase letter.");
  if (!/[0-9]/.test(password)) issues.push("Add a number.");
  return issues;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scrypt(password, salt, passwordKeyLength)) as Buffer;
  return `scrypt$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, salt, encodedKey] = passwordHash.split("$");
  if (scheme !== "scrypt" || !salt || !encodedKey) return false;
  const expected = Buffer.from(encodedKey, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashSessionToken(token: string, env: NodeJS.ProcessEnv = process.env) {
  const status = getAuthSecretStatus(env);
  return createHmac("sha256", status.secret).update(token).digest("hex");
}

export function createSessionCookieValue() {
  return randomBytes(32).toString("base64url");
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(userId: string, client: PrismaClient = prisma) {
  const secretStatus = getAuthSecretStatus();
  if (!secretStatus.usable) {
    throw new ForbiddenError("SESSION_SECRET or AUTH_SECRET must be configured before login.");
  }

  const token = createSessionCookieValue();
  const expiresAt = new Date(Date.now() + sessionTtlMs);
  await client.appSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastSeenAt: new Date(),
    },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined, client: PrismaClient = prisma) {
  if (!token) return;
  await client.appSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function getUserFromSessionToken(token: string | undefined, client: PrismaClient = prisma): Promise<AuthUser | null> {
  if (!token || !getAuthSecretStatus().usable) return null;
  const session = await client.appSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) await client.appSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  await client.appSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    username: session.user.username,
    role: session.user.role,
    isActive: session.user.isActive,
  };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getUserFromSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

export function canPerformAction(user: Pick<AuthUser, "role" | "isActive"> | null | undefined, action: PermissionAction) {
  if (!user?.isActive) return false;
  const role = user.role;
  if (role === "ADMIN") return true;
  const permissions: Record<Exclude<AppRole, "ADMIN">, PermissionAction[]> = {
    IT_STAFF: ["inventory.read", "inventory.write", "assignments.write", "loans.write", "stock.write", "rma.write", "audits.read", "audits.write", "tasks.read", "tasks.write", "labels.print", "labels.manage"],
    VIEWER: ["inventory.read"],
    AUDITOR: ["inventory.read", "audits.read", "audits.write", "tasks.read", "tasks.write", "labels.print"],
  };
  return permissions[role]?.includes(action) ?? false;
}

export async function requirePermission(action: PermissionAction) {
  const user = await requireAuth();
  if (!canPerformAction(user, action)) throw new ForbiddenError();
  return user;
}

export async function requireRole(...roles: AppRole[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export function normalizeLoginIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function sanitizeRedirectPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.startsWith("/login") || value.startsWith("/setup-admin")) return "/dashboard";
  return value;
}

export function safeUserLabel(user: Pick<AuthUser, "name" | "role">) {
  return `${user.name} (${user.role})`;
}

export function makeActivityActor(user: Pick<AuthUser, "id" | "name" | "role">) {
  return {
    actorUserId: user.id,
    actorName: user.name,
    actorRole: user.role,
  };
}

export function fingerprintEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}
