import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { GET as logoutGET } from "@/app/logout/route";
import {
  canPerformAction,
  createSession,
  createSessionCookieValue,
  getAuthSecretStatus,
  getSessionCookieOptions,
  getSessionExpiresAt,
  getUserFromSessionToken,
  hashPassword,
  hashSessionToken,
  sessionLifetimeMs,
  sessionLifetimeSeconds,
  shouldUseSecureSessionCookie,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { AuthRequiredError, ForbiddenError } from "@/lib/auth";
import { appUrl } from "@/lib/public-url";

function restoreSessionSecret(value: string | undefined) {
  if (value === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = value;
}

describe("auth helpers", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("StrongPass123");

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("StrongPass123");
    await expect(verifyPassword("StrongPass123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("validates password strength for first admin and resets", () => {
    expect(validatePasswordStrength("weak")).toContain("Use at least 10 characters.");
    expect(validatePasswordStrength("StrongPass123")).toEqual([]);
  });

  it("maps roles to expected permissions", () => {
    expect(canPerformAction({ role: "ADMIN", isActive: true }, "users.manage")).toBe(true);
    expect(canPerformAction({ role: "IT_STAFF", isActive: true }, "inventory.write")).toBe(true);
    expect(canPerformAction({ role: "IT_STAFF", isActive: true }, "tasks.write")).toBe(true);
    expect(canPerformAction({ role: "IT_STAFF", isActive: true }, "labels.print")).toBe(true);
    expect(canPerformAction({ role: "IT_STAFF", isActive: true }, "backups.manage")).toBe(false);
    expect(canPerformAction({ role: "VIEWER", isActive: true }, "inventory.read")).toBe(true);
    expect(canPerformAction({ role: "VIEWER", isActive: true }, "inventory.write")).toBe(false);
    expect(canPerformAction({ role: "VIEWER", isActive: true }, "tasks.write")).toBe(false);
    expect(canPerformAction({ role: "VIEWER", isActive: true }, "labels.print")).toBe(false);
    expect(canPerformAction({ role: "AUDITOR", isActive: true }, "audits.write")).toBe(true);
    expect(canPerformAction({ role: "AUDITOR", isActive: true }, "tasks.write")).toBe(true);
    expect(canPerformAction({ role: "AUDITOR", isActive: true }, "labels.print")).toBe(true);
    expect(canPerformAction({ role: "AUDITOR", isActive: true }, "stock.write")).toBe(false);
    expect(canPerformAction({ role: "AUDITOR", isActive: true }, "rma.write")).toBe(false);
    expect(canPerformAction({ role: "AUDITOR", isActive: true }, "settings.manage")).toBe(false);
    expect(canPerformAction({ role: "AUDITOR", isActive: false }, "audits.write")).toBe(false);
  });

  it("requires a strong session secret in production-like mode", () => {
    expect(getAuthSecretStatus({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toMatchObject({ configured: false, usable: false });
    expect(getAuthSecretStatus({ NODE_ENV: "production", SESSION_SECRET: "a".repeat(32) } as NodeJS.ProcessEnv)).toMatchObject({ configured: true, usable: true });
  });

  it("aligns DB session expiry and cookie maxAge to a fixed 12-hour lifetime", () => {
    const now = new Date("2026-06-18T12:00:00.000Z");
    const expiresAt = getSessionExpiresAt(now);
    const options = getSessionCookieOptions(expiresAt, { APP_BASE_URL: "https://warehouse-it.local" } as NodeJS.ProcessEnv);

    expect(sessionLifetimeSeconds).toBe(12 * 60 * 60);
    expect(expiresAt.getTime() - now.getTime()).toBe(sessionLifetimeMs);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 12 * 60 * 60,
      expires: expiresAt,
    });
  });

  it("sets secure session cookies for HTTPS APP_BASE_URL and production mode", () => {
    expect(shouldUseSecureSessionCookie({ APP_BASE_URL: "https://warehouse-it.local", NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldUseSecureSessionCookie({ APP_BASE_URL: "http://localhost:3000", NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldUseSecureSessionCookie({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("creates DB-backed sessions with a hashed token", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
    let storedHash = "";
    let storedExpiresAt: Date | undefined;
    const fakePrisma = {
      appSession: {
        create: async ({ data }: { data: { tokenHash: string; expiresAt: Date } }) => {
          storedHash = data.tokenHash;
          storedExpiresAt = data.expiresAt;
          return data;
        },
      },
    };

    const session = await createSession("user-1", fakePrisma as never);
    expect(session.token).toBeTruthy();
    expect(storedHash).toBe(hashSessionToken(session.token));
    expect(storedHash).not.toBe(session.token);
    expect(storedExpiresAt?.getTime()).toBe(session.expiresAt.getTime());
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 11 * 60 * 60 * 1000);
    restoreSessionSecret(previous);
  });

  it("validates active sessions and rejects inactive users", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
    const token = createSessionCookieValue();
    const fakePrisma = {
      appSession: {
        findUnique: async () => ({
          id: "session-1",
          expiresAt: new Date(Date.now() + 60_000),
          user: { id: "user-1", name: "IT Admin", email: "it@example.com", username: "it", role: "ADMIN", isActive: true },
        }),
        update: async () => undefined,
        delete: async () => undefined,
      },
    };

    await expect(getUserFromSessionToken(token, fakePrisma as never)).resolves.toMatchObject({ id: "user-1", role: "ADMIN" });
    restoreSessionSecret(previous);
  });

  it("rejects expired sessions without crashing", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
    const token = createSessionCookieValue();
    let deletedSessionId = "";
    const fakePrisma = {
      appSession: {
        findUnique: async () => ({
          id: "expired-session-1",
          expiresAt: new Date(Date.now() - 60_000),
          user: { id: "user-1", name: "IT Admin", email: "it@example.com", username: "it", role: "ADMIN", isActive: true },
        }),
        update: async () => undefined,
        delete: async ({ where }: { where: { id: string } }) => {
          deletedSessionId = where.id;
        },
      },
    };

    await expect(getUserFromSessionToken(token, fakePrisma as never)).resolves.toBeNull();
    expect(deletedSessionId).toBe("expired-session-1");
    restoreSessionSecret(previous);
  });
});

describe("auth proxy and API errors", () => {
  it("builds public auth redirect URLs from APP_BASE_URL behind a reverse proxy", () => {
    const url = appUrl("/dashboard", "http://localhost:3000/api/auth/login", { APP_BASE_URL: "https://warehouse-it.local" } as NodeJS.ProcessEnv);
    expect(url.toString()).toBe("https://warehouse-it.local/dashboard");
  });

  it("uses the public APP_BASE_URL for logout redirects", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://warehouse-it.local";

    const response = await logoutGET(new NextRequest("http://localhost:3000/logout"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://warehouse-it.local/login");

    if (previous === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previous;
  });

  it("redirects page requests without a session cookie to login", () => {
    const response = proxy(new NextRequest("http://localhost:3000/devices"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=");
  });

  it("returns JSON 401 for API requests without a session cookie", async () => {
    const response = proxy(new NextRequest("http://localhost:3000/api/devices"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Authentication required." });
  });

  it("maps auth errors to clear API responses", async () => {
    const unauthorized = handleApiError(new AuthRequiredError());
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({ error: "Authentication required." });

    const forbidden = handleApiError(new ForbiddenError());
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({ error: "You do not have permission to perform this action." });
  });
});
