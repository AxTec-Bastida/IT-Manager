import { describe, expect, it, vi, afterEach } from "vitest";
import { encryptRecoveryKey } from "@/lib/bitlocker-vault";

const qaKey = "111111-222222-333333-444444-555555-666666-777777-888888";
const secret = "phase67-test-secret-at-least-32-characters";

describe("BitLocker vault API guardrails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BITLOCKER_VAULT_SECRET;
  });

  it("blocks IT staff reveal attempts and logs without plaintext", async () => {
    process.env.BITLOCKER_VAULT_SECRET = secret;
    const activityLogs: Array<{ data: { metadata?: string } }> = [];
    const prismaMock = {
      device: {
        findUnique: vi.fn(async () => ({
          id: "asset-1",
          name: "QA Laptop",
          assetTag: "QA-BITLOCKER-001",
          bitLockerRecoveryKey: { keyId: "key-1", recoveryKeyEncrypted: encryptRecoveryKey(qaKey, secret) },
        })),
      },
      activityLog: { create: vi.fn(async (input) => activityLogs.push(input)) },
    };
    mockAuthAndPrisma({ role: "IT_STAFF" }, prismaMock);

    const route = await import("../app/api/devices/[id]/bitlocker/reveal/route");
    const response = await route.POST(new Request("http://test/api/devices/asset-1/bitlocker/reveal", { method: "POST" }) as never, { params: Promise.resolve({ id: "asset-1" }) });

    expect(response.status).toBe(403);
    expect(JSON.stringify(activityLogs)).not.toContain(qaKey);
    expect(activityLogs[0].data.metadata).toContain("forbidden");
  });

  it("allows admin reveal and records audit metadata without plaintext", async () => {
    process.env.BITLOCKER_VAULT_SECRET = secret;
    const activityLogs: Array<{ data: { metadata?: string } }> = [];
    const prismaMock = {
      device: {
        findUnique: vi.fn(async () => ({
          id: "asset-1",
          name: "QA Laptop",
          assetTag: "QA-BITLOCKER-001",
          bitLockerRecoveryKey: { keyId: "key-1", recoveryKeyEncrypted: encryptRecoveryKey(qaKey, secret) },
        })),
      },
      $transaction: vi.fn(async (callback) =>
        callback({
          bitLockerRecoveryKey: { update: vi.fn(async () => ({})) },
          activityLog: { create: vi.fn(async (input) => activityLogs.push(input)) },
        }),
      ),
    };
    mockAuthAndPrisma({ role: "ADMIN" }, prismaMock);

    const route = await import("../app/api/devices/[id]/bitlocker/reveal/route");
    const response = await route.POST(new Request("http://test/api/devices/asset-1/bitlocker/reveal", { method: "POST" }) as never, { params: Promise.resolve({ id: "asset-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recoveryKey).toBe(qaKey);
    expect(JSON.stringify(activityLogs)).not.toContain(qaKey);
    expect(activityLogs[0].data.metadata).toContain("reveal");
  });

  it("blocks vault create when the secret is missing", async () => {
    const activityLogs: Array<{ data: { metadata?: string } }> = [];
    const prismaMock = {
      activityLog: { create: vi.fn(async (input) => activityLogs.push(input)) },
    };
    mockAuthAndPrisma({ role: "ADMIN" }, prismaMock);

    const route = await import("../app/api/devices/[id]/bitlocker/route");
    const response = await route.PUT(
      new Request("http://test/api/devices/asset-1/bitlocker", {
        method: "PUT",
        body: JSON.stringify({ recoveryKey: qaKey }),
      }) as never,
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(422);
    expect(JSON.stringify(activityLogs)).not.toContain(qaKey);
    expect(activityLogs[0].data.metadata).toContain("secret_missing");
  });

  it("creates encrypted records and audit logs without plaintext", async () => {
    process.env.BITLOCKER_VAULT_SECRET = secret;
    const createdRecords: Array<{ data: { recoveryKeyEncrypted: string } }> = [];
    const activityLogs: Array<{ data: { metadata?: string } }> = [];
    const prismaMock = {
      device: {
        findUnique: vi.fn(async () => ({
          id: "asset-1",
          name: "QA Laptop",
          assetTag: "QA-BITLOCKER-001",
          category: "LAPTOP",
          bitLockerRecoveryKey: null,
        })),
      },
      $transaction: vi.fn(async (callback) =>
        callback({
          bitLockerRecoveryKey: {
            create: vi.fn(async (input) => {
              createdRecords.push(input);
              return { id: "vault-1", keyId: "key-1", source: "MANUAL", createdAt: new Date(), updatedAt: new Date(), lastViewedAt: null };
            }),
          },
          activityLog: { create: vi.fn(async (input) => activityLogs.push(input)) },
        }),
      ),
    };
    mockAuthAndPrisma({ role: "ADMIN" }, prismaMock);

    const route = await import("../app/api/devices/[id]/bitlocker/route");
    const response = await route.PUT(
      new Request("http://test/api/devices/asset-1/bitlocker", {
        method: "PUT",
        body: JSON.stringify({ recoveryKey: qaKey, keyId: "key-1", volumeLabel: "OS", protectorId: "protector-1" }),
      }) as never,
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(200);
    expect(createdRecords[0].data.recoveryKeyEncrypted).not.toContain(qaKey);
    expect(JSON.stringify(activityLogs)).not.toContain(qaKey);
  });
});

function mockAuthAndPrisma(user: { role: string }, prismaMock: unknown) {
  vi.doMock("@/lib/auth", () => ({
    getCurrentUser: vi.fn(async () => ({ id: "user-1", name: "QA User", email: "qa@example.local", username: "qa", role: user.role, isActive: true })),
    makeActivityActor: vi.fn(() => ({ actorUserId: "user-1", actorName: "QA User", actorRole: user.role })),
  }));
  vi.doMock("@/lib/prisma", () => ({ prisma: prismaMock }));
}
