import type { AccessPointMapLocation, AssetLocationHistory, Device, UnifiClientSnapshot } from "@prisma/client";
import { normalizeMacAddress } from "./ip";

export type UniFiClientInput = {
  mac?: string | null;
  ip?: string | null;
  hostname?: string | null;
  name?: string | null;
  apName?: string | null;
  apMac?: string | null;
  apId?: string | null;
  online?: boolean | null;
  signalStrength?: number | null;
  lastSeenAt?: string | Date | null;
  raw?: unknown;
};

export type LocationHistoryDecision = {
  shouldCreate: boolean;
  reason: "first_location" | "ap_changed" | "time_elapsed" | "came_online" | "no_change" | "unmapped_ap" | "offline";
};

const defaultMinimumHistoryMinutes = 30;

export function normalizeUniFiClient(input: UniFiClientInput): Required<Omit<UniFiClientInput, "raw" | "lastSeenAt">> & {
  lastSeenAt: Date | null;
  raw?: unknown;
} {
  return {
    mac: normalizeMacAddress(input.mac) ?? "",
    ip: input.ip?.trim() ?? "",
    hostname: input.hostname?.trim() ?? "",
    name: input.name?.trim() ?? "",
    apName: input.apName?.trim() ?? "",
    apMac: normalizeMacAddress(input.apMac) ?? "",
    apId: input.apId?.trim() ?? "",
    online: input.online ?? true,
    signalStrength: input.signalStrength ?? null,
    lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : null,
    raw: input.raw,
  };
}

export function matchAssetToUniFiClient(devices: Pick<Device, "id" | "macAddress" | "ipAddress" | "name">[], clientInput: UniFiClientInput) {
  const client = normalizeUniFiClient(clientInput);
  const clientMac = normalizeMacAddress(client.mac);
  if (clientMac) {
    const byMac = devices.find((device) => normalizeMacAddress(device.macAddress) === clientMac);
    if (byMac) return { device: byMac, matchedBy: "mac" as const };
  }

  if (client.ip) {
    const byIp = devices.find((device) => device.ipAddress === client.ip);
    if (byIp) return { device: byIp, matchedBy: "ip" as const };
  }

  const host = String(client.hostname || client.name || "").toLowerCase();
  if (host) {
    const byName = devices.find((device) => device.name.toLowerCase() === host);
    if (byName) return { device: byName, matchedBy: "name" as const };
  }

  return { device: null, matchedBy: null };
}

export function shouldCreateLocationHistory(
  latestHistory: Pick<AssetLocationHistory, "apMac" | "seenAt"> | null,
  previousSnapshot: Pick<UnifiClientSnapshot, "online" | "apMac"> | null,
  clientInput: UniFiClientInput,
  mappedAp: Pick<AccessPointMapLocation, "apMac"> | null,
  options: { minimumHistoryMinutes?: number; now?: Date } = {},
): LocationHistoryDecision {
  const client = normalizeUniFiClient(clientInput);
  if (!client.online) return { shouldCreate: false, reason: "offline" };
  if (!mappedAp || !client.apMac) return { shouldCreate: false, reason: "unmapped_ap" };

  const latestAp = normalizeMacAddress(latestHistory?.apMac);
  const currentAp = normalizeMacAddress(client.apMac);
  if (!latestHistory) return { shouldCreate: true, reason: "first_location" };
  if (latestAp !== currentAp) return { shouldCreate: true, reason: "ap_changed" };
  if (previousSnapshot && previousSnapshot.online === false) return { shouldCreate: true, reason: "came_online" };

  const now = options.now ?? new Date();
  const minimumMinutes = options.minimumHistoryMinutes ?? defaultMinimumHistoryMinutes;
  const elapsedMs = now.getTime() - new Date(latestHistory.seenAt).getTime();
  if (elapsedMs >= minimumMinutes * 60 * 1000) return { shouldCreate: true, reason: "time_elapsed" };

  return { shouldCreate: false, reason: "no_change" };
}

export function buildLocationHistoryData(
  assetId: string,
  clientInput: UniFiClientInput,
  mappedAp: Pick<AccessPointMapLocation, "id" | "apName" | "apMac" | "locationLabel" | "x" | "y">,
  syncedAt = new Date(),
) {
  const client = normalizeUniFiClient(clientInput);
  const seenAt = client.lastSeenAt ?? syncedAt;

  return {
    assetId,
    source: "UNIFI" as const,
    apName: mappedAp.apName,
    apMac: mappedAp.apMac,
    locationLabel: mappedAp.locationLabel,
    x: mappedAp.x,
    y: mappedAp.y,
    ipAddress: client.ip || null,
    signalStrength: client.signalStrength,
    seenAt,
    syncedAt,
    notes: "Approximate AP-based location from read-only UniFi client association.",
    apMapLocationId: mappedAp.id,
  };
}
