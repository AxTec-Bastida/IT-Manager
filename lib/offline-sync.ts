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

  if (action.actionType === "UPLOAD_ASSET_PHOTO") {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Offline photo sync requires the queued local photo file. Retry from the Offline Queue on the original browser/device.",
      resultSummary: { message: "Photo upload was sent to the metadata-only sync endpoint." },
      conflictCode: "INVALID_PAYLOAD",
    });
  }

  const note = normalizeTestOfflineNotePayload(action.payload);
  return client.$transaction(async (tx) => {
    const record = await tx.offlineSyncRecord.upsert({
      where: { clientActionId },
      create: {
        clientActionId,
        actionType: "TEST_OFFLINE_NOTE",
        status: "SYNCED",
        resolutionStatus: "RESOLVED",
        actorUserId: actor.id,
        actorName: actor.name,
        conflictCode: null,
        entityType: "offline_sync_record",
        entityLabel: "Test offline note",
        payloadSummary: summarizeOfflinePayload({ text: note.text, route: note.route, timestamp: note.timestamp }),
        resultSummary: safeJsonStringify({ message: "Test offline note synced." }),
        processedAt: new Date(),
      },
      update: {
        status: "SYNCED",
        resolutionStatus: "RESOLVED",
        actorUserId: actor.id,
        actorName: actor.name,
        conflictCode: null,
        entityType: "offline_sync_record",
        entityLabel: "Test offline note",
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
      conflictCode: "PERMISSION_DENIED",
      entityType: "device",
      entityId: payload.deviceId,
      entityLabel: payload.assetTag,
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
      conflictCode: "ASSET_NOT_FOUND",
      entityType: "device",
      entityId: payload.deviceId,
      entityLabel: payload.assetTag,
    });
  }

  const related = { relatedDeviceId: device.id, relatedAssetTag: device.assetTag };
  const relatedEntity = { entityType: "device", entityId: device.id, entityLabel: device.assetTag || device.name };
  if (["RETIRED", "DISPOSED", "LOST"].includes(device.status)) {
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: `Asset is ${device.status.replaceAll("_", " ")} and was not moved.`,
      resultSummary: { message: "Blocked retired/decommissioned asset move.", currentStatus: device.status, currentLocation: device.location, currentMapAnchorId: device.currentMapAnchorId },
      ...related,
      ...relatedEntity,
      conflictCode: "ASSET_RETIRED_OR_DECOMMISSIONED",
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
      ...relatedEntity,
      conflictCode: "STALE_LOCATION",
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
      ...relatedEntity,
      conflictCode: "STALE_ASSIGNMENT",
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
      ...relatedEntity,
      conflictCode: "STALE_LOCATION",
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
      ...relatedEntity,
      conflictCode: "TARGET_LOCATION_NOT_FOUND",
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
    return createOfflineRecordResult({ client, action, actor, status: "FAILED", message, resultSummary: { message }, ...related, ...relatedEntity, conflictCode: "INVALID_PAYLOAD" });
  }

  // 1. Fetch only duplicate candidates by IP and MAC to save huge query load
  const [duplicateIpDevice, duplicateMacDevice, activeIps, ranges] = await Promise.all([
    device.ipAddress
      ? client.device.findFirst({
          where: {
            id: { not: device.id },
            ipAddress: device.ipAddress.trim(),
            status: { notIn: ["RETIRED", "DISPOSED", "LOST"] },
          },
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
        })
      : Promise.resolve(null),
    device.macAddress
      ? client.device.findFirst({
          where: {
            id: { not: device.id },
            macAddress: device.macAddress.trim(),
            status: { notIn: ["RETIRED", "DISPOSED", "LOST"] },
          },
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
        })
      : Promise.resolve(null),
    client.device.findMany({
      where: {
        ipAddress: { not: null },
        status: { notIn: ["RETIRED", "DISPOSED", "LOST"] },
      },
      select: {
        ipAddress: true,
      },
    }),
    client.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  // Construct a minimal in-memory list for warnings validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devices: any[] = [];
  if (duplicateIpDevice) devices.push(duplicateIpDevice);
  if (duplicateMacDevice && duplicateMacDevice.id !== duplicateIpDevice?.id) {
    devices.push(duplicateMacDevice);
  }
  // Add active IPs for suggestNextIpForRange lookup
  for (const item of activeIps) {
    if (item.ipAddress && item.ipAddress !== duplicateIpDevice?.ipAddress && item.ipAddress !== duplicateMacDevice?.ipAddress) {
      devices.push({ id: `active-ip-${item.ipAddress}`, ipAddress: item.ipAddress });
    }
  }

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
      ...relatedEntity,
      conflictCode: "SERVER_VALIDATION_WARNING",
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
        resolutionStatus: "RESOLVED",
        actorUserId: actor.id,
        actorName: actor.name,
        conflictCode: null,
        entityType: "device",
        entityId: updated.id,
        entityLabel: updated.assetTag || updated.name,
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
        resolutionStatus: "RESOLVED",
        actorUserId: actor.id,
        actorName: actor.name,
        conflictCode: null,
        entityType: "device",
        entityId: updated.id,
        entityLabel: updated.assetTag || updated.name,
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
  conflictCode,
  entityType,
  entityId,
  entityLabel,
}: {
  client: PrismaClient;
  action: OfflineSyncRequestAction;
  actor: AuthUser;
  status: Extract<OfflineSyncStatus, "FAILED" | "CONFLICT">;
  message: string;
  resultSummary: Record<string, unknown>;
  relatedDeviceId?: string | null;
  relatedAssetTag?: string | null;
  conflictCode?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
}): Promise<OfflineSyncActionResult> {
  const clientActionId = typeof action.clientActionId === "string" && action.clientActionId.trim() ? action.clientActionId.trim() : `invalid-${Date.now()}`;
  const actionType = normalizeOfflineActionType(action.actionType) ?? "TEST_OFFLINE_NOTE";
  const resolvedConflictCode = conflictCode ?? inferConflictCode(message, resultSummary, action.actionType);
  const record = await client.offlineSyncRecord.upsert({
    where: { clientActionId },
    create: {
      clientActionId,
      actionType,
      status,
      resolutionStatus: "OPEN",
      actorUserId: actor.id,
      actorName: actor.name,
      conflictCode: resolvedConflictCode,
      entityType: entityType ?? (relatedDeviceId || relatedAssetTag ? "device" : "offline_sync_record"),
      entityId: entityId ?? relatedDeviceId ?? null,
      entityLabel: entityLabel ?? relatedAssetTag ?? null,
      payloadSummary: summarizeOfflinePayload(action.payload),
      resultSummary: safeJsonStringify(resultSummary),
      processedAt: new Date(),
    },
    update: {
      status,
      resolutionStatus: "OPEN",
      actorUserId: actor.id,
      actorName: actor.name,
      conflictCode: resolvedConflictCode,
      entityType: entityType ?? (relatedDeviceId || relatedAssetTag ? "device" : "offline_sync_record"),
      entityId: entityId ?? relatedDeviceId ?? null,
      entityLabel: entityLabel ?? relatedAssetTag ?? null,
      payloadSummary: summarizeOfflinePayload(action.payload),
      resultSummary: safeJsonStringify(resultSummary),
      processedAt: new Date(),
    },
  });
  await client.activityLog.create({
    data: {
      ...makeActivityActor(actor),
      action: status === "CONFLICT" ? "offline.conflict.created" : "offline.sync.failed",
      entity: "offline_sync_record",
      entityId: record.id,
      message: `Offline ${actionType} ${status.toLowerCase()} for review.`,
      metadata: safeJsonStringify({ clientActionId, conflictCode: resolvedConflictCode, entityType: entityType ?? null, entityId: entityId ?? relatedDeviceId ?? null, entityLabel: entityLabel ?? relatedAssetTag ?? null }),
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

function inferConflictCode(message: string, resultSummary: Record<string, unknown>, actionType: unknown) {
  const text = `${String(actionType ?? "")} ${message} ${typeof resultSummary.message === "string" ? resultSummary.message : ""}`.toLowerCase();
  if (text.includes("not supported offline")) return "UNSUPPORTED_ACTION";
  if (text.includes("permission")) return "PERMISSION_DENIED";
  if (text.includes("asset missing") || text.includes("asset could not be found")) return "ASSET_NOT_FOUND";
  if (text.includes("retired") || text.includes("disposed") || text.includes("lost")) return "ASSET_RETIRED_OR_DECOMMISSIONED";
  if (text.includes("target location anchor") || text.includes("invalid target map anchor")) return "TARGET_LOCATION_NOT_FOUND";
  if (text.includes("assignment")) return "STALE_ASSIGNMENT";
  if (text.includes("stale") || text.includes("location changed") || text.includes("status changed")) return "STALE_LOCATION";
  if (text.includes("warning") || text.includes("needs review")) return "SERVER_VALIDATION_WARNING";
  if (text.includes("invalid") || text.includes("malformed") || text.includes("missing") || text.includes("sensitive") || text.includes("secret") || text.includes("bitlocker")) return "INVALID_PAYLOAD";
  return "UNKNOWN_SYNC_ERROR";
}
