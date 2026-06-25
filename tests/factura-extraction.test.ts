import { describe, expect, it, vi } from "vitest";

const EXTRACTION_ROUTE_TEST_TIMEOUT_MS = 30000;

describe("factura extraction API permissions", () => {
  it("returns 401 when extraction is requested without auth", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", async () => {
      const { AuthRequiredError } = await vi.importActual<typeof import("@/lib/auth-errors")>("@/lib/auth-errors");
      return {
        requirePermission: vi.fn(async () => {
          throw new AuthRequiredError();
        }),
        makeActivityActor: vi.fn(),
      };
    });

    const route = await import("../app/api/facturas/[id]/extract-line-items/route");
    const response = await route.POST(new Request("http://test/api/facturas/f-1/extract-line-items", { method: "POST" }) as never, { params: Promise.resolve({ id: "f-1" }) });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Authentication required." });
  }, EXTRACTION_ROUTE_TEST_TIMEOUT_MS);

  it("returns 403 when a read-only role cannot extract", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", async () => {
      const { ForbiddenError } = await vi.importActual<typeof import("@/lib/auth-errors")>("@/lib/auth-errors");
      return {
        requirePermission: vi.fn(async () => {
          throw new ForbiddenError();
        }),
        makeActivityActor: vi.fn(),
      };
    });

    const route = await import("../app/api/facturas/[id]/extract-line-items/route");
    const response = await route.POST(new Request("http://test/api/facturas/f-1/extract-line-items", { method: "POST" }) as never, { params: Promise.resolve({ id: "f-1" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "You do not have permission to perform this action." });
  }, EXTRACTION_ROUTE_TEST_TIMEOUT_MS);

  it("returns 401 when XML extraction is requested without auth", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", async () => {
      const { AuthRequiredError } = await vi.importActual<typeof import("@/lib/auth-errors")>("@/lib/auth-errors");
      return {
        requirePermission: vi.fn(async () => {
          throw new AuthRequiredError();
        }),
        makeActivityActor: vi.fn(),
      };
    });

    const route = await import("../app/api/facturas/[id]/extract-xml-line-items/route");
    const response = await route.POST(new Request("http://test/api/facturas/f-1/extract-xml-line-items", { method: "POST" }) as never, { params: Promise.resolve({ id: "f-1" }) });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Authentication required." });
  }, EXTRACTION_ROUTE_TEST_TIMEOUT_MS);

  it("returns 403 when a read-only role cannot extract XML", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth", async () => {
      const { ForbiddenError } = await vi.importActual<typeof import("@/lib/auth-errors")>("@/lib/auth-errors");
      return {
        requirePermission: vi.fn(async () => {
          throw new ForbiddenError();
        }),
        makeActivityActor: vi.fn(),
      };
    });

    const route = await import("../app/api/facturas/[id]/extract-xml-line-items/route");
    const response = await route.POST(new Request("http://test/api/facturas/f-1/extract-xml-line-items", { method: "POST" }) as never, { params: Promise.resolve({ id: "f-1" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "You do not have permission to perform this action." });
  }, EXTRACTION_ROUTE_TEST_TIMEOUT_MS);
});
