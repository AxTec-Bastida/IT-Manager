import type { OfflineActionType, OfflineSyncStatus, PrismaClient } from "@prisma/client";
import { canPerformAction, makeActivityActor, type AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildMoveWarnings, moveRequiresConfirmation, MoveInputError, normalizeMoveInput } from "@/lib/equipment-move";
import {
  normalizeOfflineMovePayload,
  normalizeTestOfflineNotePayload,
  safeJsonStringify,
  summarizeOfflinePayload,
  type OfflineSyncActionResult,
  type OfflineSyncRequestAction,
  validateOfflineSyncAction,
} from "@/lib/offline-actions";

export type OfflineSyncBatchResult = {
  results: OfflineSyncActionResult[];
  summary: {
    total: number;
    synced: number;
    failed: number;
    conflict: number;
  };
};

export async function processOfflineSyncBatch(actions: OfflineSyncRequestAction[], actor: AuthUser, client: PrismaClient = prisma): Promise<OfflineSyncBatchResult> {
  const results: OfflineSyncActionResult[] = [];
  for (const action of actions) {
    results.push(await processOfflineSyncAction(action, actor, client));
  }
  return {
    results,
    summary: {
      total: results.length,
      synced: results.filter((result) => result.status === "SYNCED").length,
      failed: results.filter((result) => result.status === "FAILED").length,
      conflict: results.filter((result) => result.status === "CONFLICT").length,
    },
  };
}

async function processOfflineSyncAction(action: OfflineSyncRequestAction, actor: AuthUser, client: PrismaClient): Promise<OfflineSyncActionResult> {
  const clientActionId = typeof action.clientActionId === "string" && action.clientActionId.trim() ? action.clientActionId.trim() : "missing-client-action-id";
  const recognizedType = normalizeOfflineActionType(action.actionType);
  const existing = clientActionId !== "missing-client-action-id" ? await client.offlineSyncRecord.findUnique({ where: { clientActionId } }) : null;
  if (existing?.status === "SYNCED") {
    return {
      clientActionId,
      status: "SYNCED",
      message: "Action was already synced.",
      serverId: existing.id,
    };
  }

  const validation = validateOfflineSyncAction(action);
  if (!validation.ok) {
    const sensitiveFailure = /sensitive|secret|BitLocker/i.test(validation.message);
    const failureStatus = recognizedType && action.actionType !== "TEST_OFFLINE_NOTE" && !sensitiveFailure ? "CONFLICT" : "FAILED";
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: failureStatus,
      message: validation.message,
      resultSummary: { message: validation.message },
    });
  }

  if (action.actionType === "MOVE_ASSET") {
    return processMoveAssetAction(action, actor, client);
  }

  const note = normalizeTestOfflineNotePayload(action.payload);
  return client.$transaction(async (tx) => {
    const record = await tx.offlineSyncRecord.upsert({
      where: { clientActionId },
      create: {
        clientActionId,
        actionType: "TEST_OFFLINE_NOTE",
        status: "SYNCED",
        actorUserId: actor.id,
        actorName: actor.name,
        payloadSummary: summarizeOfflinePayload({ text: note.text, route: note.route, timestamp: note.timestamp }),
        resultSummary: safeJsonStringify({ message: "Test offline note synced." }),
        processedAt: new Date(),
      },
      update: {
        status: "SYNCED",
        actorUserId: actor.id,
        actorName: actor.name,
        payloadSummary: summarizeOfflinePayload({ text: note.text, route: note.route, timestamp: note.timestamp }),
        resultSummary: safeJsonStringify({ message: "Test offline note synced." }),
        processedAt: new Date(),
      },
    });
    await tx.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "offline.test_note.synced",
        entity: "offline_sync_record",
        entityId: record.id,
        message: `Offline test note synced by ${actor.name}.`,
        metadata: safeJsonStringify({ clientActionId, route: note.route || null }),
      },
    });
    return {
      clientActionId,
      status: "SYNCED" as const,
      message: "Test offline note synced.",
      serverId: record.id,
    };
  });
}

async function processMoveAssetAction(action: OfflineSyncRequestAction, actor: AuthUser, client: PrismaClient): Promise<OfflineSyncActionResult> {
  const clientActionId = action.clientActionId.trim();
  const payload = normalizeOfflineMovePayload(action.payload);

  if (!canPerformAction(actor, "inventory.write")) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "You no longer have permission to move inventory assets.",
      resultSummary: { message: "Permission denied at sync time.", assetTag: payload.assetTag, deviceId: payload.deviceId },
      relatedDeviceId: payload.deviceId,
      relatedAssetTag: payload.assetTag,
    });
  }

  const device = await client.device.findFirst({
    where: {
      OR: [
        ...(payload.deviceId ? [{ id: payload.deviceId }] : []),
        ...(payload.assetTag ? [{ assetTag: payload.assetTag }] : []),
      ],
    },
    include: {
      assignmentItems: {
        where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
        select: { assignmentId: true },
        take: 1,
      },
      assetLoanItems: {
        where: { returnStatus: "PENDING", loan: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } },
        select: { id: true, loanId: true },
        take: 1,
      },
      rmaItems: {
        where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } },
        select: { id: true, rmaCaseId: true },
        take: 1,
      },
    },
  });

  if (!device) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Asset could not be found during sync.",
      resultSummary: { message: "Asset missing at sync time.", assetTag: payload.assetTag, deviceId: payload.deviceId },
      relatedDeviceId: payload.deviceId,
      relatedAssetTag: payload.assetTag,
    });
  }

  const related = { relatedDeviceId: device.id, relatedAssetTag: device.assetTag };
  if (["RETIRED", "DISPOSED", "LOST"].includes(device.status)) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: `Asset is ${device.status.replaceAll("_", " ")} and was not moved.`,
      resultSummary: { message: "Blocked retired/decommissioned asset move.", currentStatus: device.status, currentLocation: device.location, currentMapAnchorId: device.currentMapAnchorId },
      ...related,
    });
  }

  if (payload.lastKnownDeviceStatus && payload.lastKnownDeviceStatus !== device.status) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: `Asset status changed from ${payload.lastKnownDeviceStatus.replaceAll("_", " ")} to ${device.status.replaceAll("_", " ")} before sync.`,
      resultSummary: { message: "Stale status conflict.", previousStatus: payload.lastKnownDeviceStatus, currentStatus: device.status, currentLocation: device.location },
      ...related,
    });
  }

  const activeAssignmentId = device.assignmentItems[0]?.assignmentId ?? null;
  if (payload.hasLastKnownAssignmentId && payload.lastKnownAssignmentId !== activeAssignmentId) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Asset assignment changed before sync. Review the move before applying it.",
      resultSummary: { message: "Stale assignment conflict.", previousAssignmentId: payload.lastKnownAssignmentId, currentAssignmentId: activeAssignmentId },
      ...related,
    });
  }

  const currentMapAnchorId = device.currentMapAnchorId ?? null;
  if (payload.hasLastKnownMapAnchorId && payload.lastKnownMapAnchorId !== currentMapAnchorId) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Asset map location changed before sync. Review the move before applying it.",
      resultSummary: { message: "Stale map anchor conflict.", previousMapAnchorId: payload.lastKnownMapAnchorId, currentMapAnchorId, currentLocation: device.location },
      ...related,
    });
  }

  const mapAnchor = payload.targetMapAnchorId
    ? await client.accessPointMapLocation.findFirst({
        where: { id: payload.targetMapAnchorId, active: true },
        select: { id: true, apName: true, locationLabel: true, area: true, department: true, station: true, displayPath: true },
      })
    : null;
  if (payload.targetMapAnchorId && !mapAnchor) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Target location anchor no longer exists or is inactive.",
      resultSummary: { message: "Invalid target map anchor.", targetMapAnchorId: payload.targetMapAnchorId },
      ...related,
    });
  }

  let input;
  try {
    input = normalizeMoveInput({
      area: payload.targetArea ?? mapAnchor?.area ?? "",
      department: payload.targetDepartment ?? mapAnchor?.department ?? "",
      location: payload.targetStation ?? payload.targetLocationLabel ?? mapAnchor?.station ?? mapAnchor?.locationLabel ?? "",
      notes: payload.notes,
      mapAnchorId: payload.targetMapAnchorId,
      keepCurrentIp: true,
      confirmWarnings: false,
      markActive: false,
    });
  } catch (error) {
    const message = error instanceof MoveInputError ? error.message : "Offline move payload is malformed.";
    return createOfflineRecordResult({ client, action, actor, status: "FAILED", message, resultSummary: { message }, ...related });
  }

  const [devices, ranges] = await Promise.all([
    client.device.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        ipAddress: true,
        macAddress: true,
        vlan: true,
        location: true,
        areaDepartment: true,
        usesStaticIp: true,
        isFixedAsset: true,
        ipRangeId: true,
      },
    }),
    client.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const { warnings, expectedRange, suggestion } = buildMoveWarnings(device, input, devices, ranges);
  if (moveRequiresConfirmation(warnings)) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Move needs review before it can be applied.",
      resultSummary: { message: "Blocking move warning.", warnings, currentStatus: device.status, currentLocation: device.location },
      ...related,
    });
  }

  const previous = {
    status: device.status,
    location: device.location,
    areaDepartment: device.areaDepartment,
    ipAddress: device.ipAddress,
    macAddress: device.macAddress,
    vlan: device.vlan,
    ipRangeId: device.ipRangeId,
    usesStaticIp: device.usesStaticIp,
    isFixedAsset: device.isFixedAsset,
    currentMapAnchorId: device.currentMapAnchorId,
  };

  return client.$transaction(async (tx) => {
    const updated = await tx.device.update({
      where: { id: device.id },
      data: {
        location: input.location,
        areaDepartment: input.areaDepartment,
        currentMapAnchorId: input.mapAnchorId,
      },
    });
    const activity = await tx.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "device.offline_move.synced",
        entity: "device",
        entityId: device.id,
        message: `${updated.name} offline move synced.`,
        metadata: safeJsonStringify({
          clientActionId,
          previous,
          next: {
            status: updated.status,
            location: updated.location,
            areaDepartment: updated.areaDepartment,
            ipAddress: updated.ipAddress,
            macAddress: updated.macAddress,
            vlan: updated.vlan,
            ipRangeId: updated.ipRangeId,
            usesStaticIp: updated.usesStaticIp,
            isFixedAsset: updated.isFixedAsset,
            currentMapAnchorId: updated.currentMapAnchorId,
            mapAnchor: mapAnchor ? { id: mapAnchor.id, name: mapAnchor.apName, path: mapAnchor.displayPath ?? mapAnchor.locationLabel } : null,
          },
          requested: {
            targetLocationLabel: payload.targetLocationLabel,
            targetArea: payload.targetArea,
            targetDepartment: payload.targetDepartment,
            targetStation: payload.targetStation,
            targetMapAnchorId: payload.targetMapAnchorId,
            movedAtClient: payload.movedAtClient,
            clientRoute: payload.clientRoute,
          },
          expectedRange: expectedRange ? { id: expectedRange.id, name: expectedRange.name, vlan: expectedRange.vlan, startIp: expectedRange.startIp, endIp: expectedRange.endIp } : null,
          suggestion,
          warnings,
        }),
      },
    });
    const record = await tx.offlineSyncRecord.upsert({
      where: { clientActionId },
      create: {
        clientActionId,
        actionType: "MOVE_ASSET",
        status: "SYNCED",
        actorUserId: actor.id,
        actorName: actor.name,
        payloadSummary: summarizeOfflinePayload({
          assetTag: payload.assetTag,
          deviceId: payload.deviceId,
          targetLocationLabel: payload.targetLocationLabel,
          targetArea: payload.targetArea,
          targetDepartment: payload.targetDepartment,
          targetStation: payload.targetStation,
          targetMapAnchorId: payload.targetMapAnchorId,
          notes: payload.notes,
        }),
        resultSummary: safeJsonStringify({ message: "Offline move synced.", deviceId: updated.id, assetTag: updated.assetTag, activityLogId: activity.id, location: updated.location, areaDepartment: updated.areaDepartment }),
        processedAt: new Date(),
      },
      update: {
        status: "SYNCED",
        actorUserId: actor.id,
        actorName: actor.name,
        resultSummary: safeJsonStringify({ message: "Offline move synced.", deviceId: updated.id, assetTag: updated.assetTag, activityLogId: activity.id, location: updated.location, areaDepartment: updated.areaDepartment }),
        processedAt: new Date(),
      },
    });
    return {
      clientActionId,
      status: "SYNCED" as const,
      message: `Moved ${updated.assetTag || updated.name} to ${[updated.areaDepartment, updated.location].filter(Boolean).join(" / ") || "the selected location"}.`,
      serverId: record.id,
      relatedDeviceId: updated.id,
      relatedAssetTag: updated.assetTag,
    };
  });
}

async function createOfflineRecordResult({
  client,
  action,
  actor,
  status,
  message,
  resultSummary,
  relatedDeviceId,
  relatedAssetTag,
}: {
  client: PrismaClient;
  action: OfflineSyncRequestAction;
  actor: AuthUser;
  status: Extract<OfflineSyncStatus, "FAILED" | "CONFLICT">;
  message: string;
  resultSummary: Record<string, unknown>;
  relatedDeviceId?: string | null;
  relatedAssetTag?: string | null;
}): Promise<OfflineSyncActionResult> {
  const clientActionId = typeof action.clientActionId === "string" && action.clientActionId.trim() ? action.clientActionId.trim() : `invalid-${Date.now()}`;
  const actionType = normalizeOfflineActionType(action.actionType) ?? "TEST_OFFLINE_NOTE";
  const record = await client.offlineSyncRecord.upsert({
    where: { clientActionId },
    create: {
      clientActionId,
      actionType,
      status,
      actorUserId: actor.id,
      actorName: actor.name,
      payloadSummary: summarizeOfflinePayload(action.payload),
      resultSummary: safeJsonStringify(resultSummary),
      processedAt: new Date(),
    },
    update: {
      status,
      actorUserId: actor.id,
      actorName: actor.name,
      payloadSummary: summarizeOfflinePayload(action.payload),
      resultSummary: safeJsonStringify(resultSummary),
      processedAt: new Date(),
    },
  });

  return {
    clientActionId,
    status,
    message,
    serverId: record.id,
    relatedDeviceId: relatedDeviceId ?? null,
    relatedAssetTag: relatedAssetTag ?? null,
    ...(status === "CONFLICT" ? { conflict: { reason: message } } : {}),
  };
}

function normalizeOfflineActionType(value: unknown): OfflineActionType | null {
  if (value === "TEST_OFFLINE_NOTE" || value === "MOVE_ASSET" || value === "CREATE_TASK" || value === "CREATE_MAINTENANCE_RECORD" || value === "UPLOAD_ASSET_PHOTO") return value;
  return null;
}
