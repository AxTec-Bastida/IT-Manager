import { describe, expect, it, vi } from "vitest";
import { ClientInputError, handleApiError } from "@/lib/api";
import { isLegacyUnifiSyncEnabled, legacyUnifiDisabledMessage } from "@/lib/unifi-disabled";

describe("API hardening helpers", () => {
  it("keeps client input errors clear while hiding unexpected server details", async () => {
    const client = await handleApiError(new ClientInputError("Stock quantity is too low."));
    expect(client.status).toBe(422);
    await expect(client.json()).resolves.toMatchObject({ error: "Stock quantity is too low." });

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const server = await handleApiError(new Error("database password leaked in stack"));
    expect(server.status).toBe(500);
    await expect(server.json()).resolves.toMatchObject({ error: "Unexpected server error." });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("keeps legacy UniFi sync disabled unless explicitly opted in", async () => {
    expect(isLegacyUnifiSyncEnabled({ LEGACY_UNIFI_SYNC_ENABLED: undefined })).toBe(false);
    expect(isLegacyUnifiSyncEnabled({ LEGACY_UNIFI_SYNC_ENABLED: "true" })).toBe(true);

    vi.resetModules();
    const route = await import("../app/api/unifi/location-sync/route");
    const response = await route.POST(new Request("http://test/api/unifi/location-sync", { method: "POST", body: "{}" }) as never);
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ error: legacyUnifiDisabledMessage });
  });
});
