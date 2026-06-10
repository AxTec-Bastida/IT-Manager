import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { isLegacyUnifiSyncEnabled, legacyUnifiDisabledMessage } from "@/lib/unifi-disabled";
import {
  buildLocationHistoryData,
  matchAssetToUniFiClient,
  normalizeUniFiClient,
  shouldCreateLocationHistory,
  type UniFiClientInput,
} from "@/lib/unifi-location";

export async function POST(request: NextRequest) {
  if (!isLegacyUnifiSyncEnabled()) return jsonError(legacyUnifiDisabledMessage, 410);
  try {
    const body = await request.json();
    const clients = Array.isArray(body.clients) ? (body.clients as UniFiClientInput[]) : [];
    const minimumHistoryMinutes = Number(body.minimumHistoryMinutes ?? 30);
    const syncedAt = new Date();

    const [devices, mappedAps] = await Promise.all([
      prisma.device.findMany({ select: { id: true, name: true, ipAddress: true, macAddress: true } }),
      prisma.accessPointMapLocation.findMany({ where: { active: true } }),
    ]);

    const apByMac = new Map(mappedAps.map((ap) => [ap.apMac.toUpperCase(), ap]));
    const results = [];

    for (const input of clients) {
      const client = normalizeUniFiClient(input);
      const match = matchAssetToUniFiClient(devices, input);
      const mappedAp = client.apMac ? apByMac.get(client.apMac.toUpperCase()) ?? null : null;
      const previousSnapshot = client.mac
        ? await prisma.unifiClientSnapshot.findFirst({ where: { clientMac: client.mac }, orderBy: { syncedAt: "desc" } })
        : null;

      const snapshot = await prisma.unifiClientSnapshot.create({
        data: {
          assetId: match.device?.id ?? null,
          clientMac: client.mac || "UNKNOWN",
          ipAddress: client.ip || null,
          hostname: client.hostname || null,
          name: client.name || null,
          apName: client.apName || null,
          apMac: client.apMac || null,
          unifiApId: client.apId || null,
          online: client.online ?? false,
          signalStrength: client.signalStrength,
          lastSeenAt: client.lastSeenAt,
          syncedAt,
          raw: input.raw ? JSON.stringify(input.raw) : JSON.stringify(input),
        },
      });

      let historyCreated = false;
      let decisionReason = "not_matched";
      if (match.device) {
        const latestHistory = await prisma.assetLocationHistory.findFirst({
          where: { assetId: match.device.id },
          orderBy: { seenAt: "desc" },
        });
        const decision = shouldCreateLocationHistory(latestHistory, previousSnapshot, input, mappedAp, {
          minimumHistoryMinutes,
          now: syncedAt,
        });
        decisionReason = decision.reason;

        if (decision.shouldCreate && mappedAp) {
          await prisma.assetLocationHistory.create({
            data: buildLocationHistoryData(match.device.id, input, mappedAp, syncedAt),
          });
          await prisma.device.update({ where: { id: match.device.id }, data: { lastSeenAt: client.lastSeenAt ?? syncedAt } });
          historyCreated = true;
        }
      }

      results.push({
        clientMac: client.mac,
        assetId: match.device?.id ?? null,
        matchedBy: match.matchedBy,
        mappedAp: mappedAp?.locationLabel ?? null,
        snapshotId: snapshot.id,
        historyCreated,
        decisionReason,
      });
    }

    await prisma.activityLog.create({
      data: {
        action: "unifi.location_sync",
        entity: "unifi",
        message: `Processed ${clients.length} read-only UniFi client location record${clients.length === 1 ? "" : "s"}.`,
        metadata: JSON.stringify({ createdHistoryRows: results.filter((result) => result.historyCreated).length }),
      },
    });

    return NextResponse.json({ readOnly: true, processed: results.length, results });
  } catch (error) {
    return handleApiError(error);
  }
}
