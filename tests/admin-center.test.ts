import { describe, expect, it, vi, afterEach } from "vitest";
import { toolLinkSchema } from "@/lib/validation";

describe("Admin Center & Master Data validations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // 1. ToolLink Schema validation for requiresCredentials flag
  it("validates requiresCredentials in toolLinkSchema", () => {
    const validResult = toolLinkSchema.safeParse({
      name: "IT Credentials Vault",
      url: "https://vault.example.com",
      category: "DOCUMENTS_SOPS",
      requiresCredentials: true,
    });
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.requiresCredentials).toBe(true);
    }

    const defaultResult = toolLinkSchema.safeParse({
      name: "IT Blog",
      url: "https://blog.example.com",
      category: "OTHER",
    });
    expect(defaultResult.success).toBe(true);
    if (defaultResult.success) {
      expect(defaultResult.data.requiresCredentials).toBe(false);
    }
  });

  // 2. Master Data: Duplicate active value rejection
  it("blocks duplicate controlled value creation", async () => {
    const prismaMock = {
      controlledValue: {
        findUnique: vi.fn(async () => ({
          id: "cv-1",
          type: "ASSET_CATEGORY",
          name: "Laptop",
          normalizedName: "LAPTOP",
        })),
      },
    };
    mockAuthAndPrisma({ role: "ADMIN" }, prismaMock);

    const route = await import("../app/api/admin/master-data/route");
    const response = await route.POST(
      new Request("http://test/api/admin/master-data", {
        method: "POST",
        body: JSON.stringify({ type: "ASSET_CATEGORY", name: "Laptop" }),
      })
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("already exists");
  });

  // 3. Master Data: Used-value deletion block
  it("blocks deleting a controlled value currently in use", async () => {
    const prismaMock = {
      controlledValue: {
        findUnique: vi.fn(async () => ({
          id: "cv-1",
          type: "ASSET_CATEGORY",
          name: "Laptop",
          normalizedName: "LAPTOP",
        })),
      },
      device: {
        count: vi.fn(async () => 5), // laptop category has 5 devices
      },
    };
    mockAuthAndPrisma({ role: "ADMIN" }, prismaMock);

    const route = await import("../app/api/admin/master-data/[id]/route");
    const response = await route.DELETE(
      new Request("http://test/api/admin/master-data/cv-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "cv-1" }) }
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("used by existing records");
  });

  // 4. IP Ranges: Overlapping active subnets rejected
  it("blocks overlapping active IP ranges", async () => {
    const prismaMock = {
      ipRange: {
        findMany: vi.fn(async () => [
          {
            id: "range-1",
            name: "IT Subnet 1",
            active: true,
            vlan: 10,
            startIp: "192.168.1.1",
            endIp: "192.168.1.254",
          },
        ]),
      },
    };
    mockAuthAndPrisma({ role: "IT_STAFF" }, prismaMock);

    const route = await import("../app/api/ranges/route");
    const response = await route.POST(
      new Request("http://test/api/ranges", {
        method: "POST",
        body: JSON.stringify({
          name: "IT Subnet 2",
          category: "OTHER",
          vlan: 10,
          startIp: "192.168.1.100", // overlaps
          endIp: "192.168.1.200",
          active: true,
        }),
      })
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("Overlaps with existing active range");
  });

  // 5. IP Ranges: Hard delete blocked if range is in use by devices
  it("blocks hard deleting an IP range currently in use by devices", async () => {
    const prismaMock = {
      ipRange: {
        findUnique: vi.fn(async () => ({
          id: "range-1",
          name: "IT Subnet 1",
          _count: { devices: 3 }, // 3 devices assigned
        })),
      },
    };
    mockAuthAndPrisma({ role: "IT_STAFF" }, prismaMock);

    const route = await import("../app/api/ranges/[id]/route");
    const response = await route.DELETE(
      new Request("http://test/api/ranges/range-1?hard=true", { method: "DELETE" }),
      { params: Promise.resolve({ id: "range-1" }) }
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("referenced by existing devices");
  });
});

function mockAuthAndPrisma(user: { role: string }, prismaMock: unknown) {
  vi.doMock("@/lib/auth", () => ({
    getCurrentUser: vi.fn(async () => ({
      id: "user-1",
      name: "QA User",
      email: "qa@example.local",
      username: "qa",
      role: user.role,
      isActive: true,
    })),
    makeActivityActor: vi.fn(() => ({
      actorUserId: "user-1",
      actorName: "QA User",
      actorRole: user.role,
    })),
    requirePermission: vi.fn(async () => ({
      id: "user-1",
      name: "QA User",
      role: user.role,
    })),
  }));
  vi.doMock("@/lib/prisma", () => ({ prisma: prismaMock }));
}
