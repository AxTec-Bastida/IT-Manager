import { describe, expect, it } from "vitest";
import type { AccessPointMapLocation, AssetLocationHistory, Device, UnifiClientSnapshot } from "@prisma/client";
import { getLastFiveLocations, getLastKnownLocation } from "@/lib/location-history";
import { buildLocationHistoryData, matchAssetToUniFiClient, shouldCreateLocationHistory } from "@/lib/unifi-location";

const device = (overrides: Partial<Device>): Device => ({
  id: overrides.id ?? "asset-1",
  name: overrides.name ?? "SCAN-CART-01",
  category: overrides.category ?? "SCANNER",
  ipAddress: overrides.ipAddress ?? "192.168.130.30",
  macAddress: overrides.macAddress ?? "84:24:8D:10:20:30",
  vlan: overrides.vlan ?? 130,
  location: null,
  brand: null,
  model: null,
  serialNumber: null,
  status: overrides.status ?? "ACTIVE",
  assignedTo: null,
  notes: null,
  lastSeenAt: null,
  ipRangeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const ap: AccessPointMapLocation = {
  id: "ap-1",
  apName: "U6-Pro-Pack",
  apMac: "AA:BB:CC:00:00:02",
  unifiDeviceId: "unifi-ap-pack",
  locationLabel: "Packing Lanes",
  floorName: "Floor 1",
  mapName: "Main",
  x: 78,
  y: 28,
  notes: null,
  active: true,
  mapId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function history(overrides: Partial<AssetLocationHistory>): AssetLocationHistory {
  return {
    id: overrides.id ?? "history-1",
    assetId: overrides.assetId ?? "asset-1",
    source: "UNIFI",
    apName: overrides.apName ?? "U6-Pro-Pack",
    apMac: overrides.apMac ?? "AA:BB:CC:00:00:02",
    locationLabel: overrides.locationLabel ?? "Packing Lanes",
    x: overrides.x ?? 78,
    y: overrides.y ?? 28,
    ipAddress: null,
    signalStrength: null,
    seenAt: overrides.seenAt ?? new Date("2026-04-30T10:00:00Z"),
    syncedAt: overrides.syncedAt ?? new Date("2026-04-30T10:00:00Z"),
    notes: null,
    apMapLocationId: null,
  };
}

describe("UniFi asset matching", () => {
  it("matches by MAC before IP or hostname", () => {
    const result = matchAssetToUniFiClient([device({})], {
      mac: "84248d102030",
      ip: "192.168.130.99",
      hostname: "different",
    });

    expect(result.device?.id).toBe("asset-1");
    expect(result.matchedBy).toBe("mac");
  });
});

describe("UniFi location history decisions", () => {
  it("creates history for first mapped online location", () => {
    const decision = shouldCreateLocationHistory(null, null, { online: true, apMac: ap.apMac }, ap);
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reason).toBe("first_location");
  });

  it("does not create duplicate spam rows for repeated sync on same AP", () => {
    const decision = shouldCreateLocationHistory(
      history({ seenAt: new Date("2026-04-30T10:00:00Z") }),
      null,
      { online: true, apMac: ap.apMac },
      ap,
      { now: new Date("2026-04-30T10:05:00Z"), minimumHistoryMinutes: 30 },
    );
    expect(decision.shouldCreate).toBe(false);
    expect(decision.reason).toBe("no_change");
  });

  it("creates history when AP changes", () => {
    const decision = shouldCreateLocationHistory(
      history({ apMac: "AA:BB:CC:00:00:01" }),
      null,
      { online: true, apMac: ap.apMac },
      ap,
    );
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reason).toBe("ap_changed");
  });

  it("creates history when a device comes back online", () => {
    const previousSnapshot = { online: false, apMac: ap.apMac } as Pick<UnifiClientSnapshot, "online" | "apMac">;
    const decision = shouldCreateLocationHistory(history({}), previousSnapshot, { online: true, apMac: ap.apMac }, ap);
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reason).toBe("came_online");
  });

  it("builds a location history record from a mapped AP", () => {
    const data = buildLocationHistoryData("asset-1", { ip: "192.168.130.30", apMac: ap.apMac, signalStrength: -61 }, ap);
    expect(data.locationLabel).toBe("Packing Lanes");
    expect(data.x).toBe(78);
    expect(data.signalStrength).toBe(-61);
  });
});

describe("last known location retrieval", () => {
  const rows = [
    history({ id: "old", seenAt: new Date("2026-04-30T08:00:00Z") }),
    history({ id: "latest", seenAt: new Date("2026-04-30T12:00:00Z") }),
    history({ id: "mid", seenAt: new Date("2026-04-30T10:00:00Z") }),
    history({ id: "four", seenAt: new Date("2026-04-30T09:00:00Z") }),
    history({ id: "five", seenAt: new Date("2026-04-30T07:00:00Z") }),
    history({ id: "six", seenAt: new Date("2026-04-30T06:00:00Z") }),
  ];

  it("returns the newest location", () => {
    expect(getLastKnownLocation(rows)?.id).toBe("latest");
  });

  it("returns only the last five locations in newest-first order", () => {
    const lastFive = getLastFiveLocations(rows);
    expect(lastFive).toHaveLength(5);
    expect(lastFive.map((row) => row.id)).toEqual(["latest", "mid", "four", "old", "five"]);
  });
});
