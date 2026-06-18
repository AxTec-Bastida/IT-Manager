import type { OfflineSyncStatus, PrismaClient } from "@prisma/client";
import { canPerformAction, makeActivityActor, type AuthUser } from "@/lib/auth";
import { createAssetPhotoUpload } from "@/lib/asset-photos";
import { prisma } from "@/lib/prisma";
import {
  normalizeOfflineAssetPhotoPayload,
  safeJsonStringify,
  summarizeOfflinePayload,
  type OfflineSyncActionResult,
  type OfflineSyncRequestAction,
  validateOfflineSyncAction,
} from "@/lib/offline-actions";

type PhotoSyncInput = OfflineSyncRequestAction & {
  file?: File | null;
};

export async function processOfflinePhotoSyncAction(input: PhotoSyncInput, actor: AuthUser, client: PrismaClient = prisma): Promise<OfflineSyncActionResult> {
  const action: OfflineSyncRequestAction = {
    clientActionId: typeof input.clientActionId === "string" ? input.clientActionId.trim() : "",
    actionType: "UPLOAD_ASSET_PHOTO",
    payload: input.payload,
    createdAt: input.createdAt,
    schemaVersion: input.schemaVersion,
  };
  const clientActionId = action.clientActionId || "missing-client-action-id";
  const existing = clientActionId !== "missing-client-action-id" ? await client.offlineSyncRecord.findUnique({ where: { clientActionId } }) : null;
  if (existing?.status === "SYNCED") {
    const result = parseResult(existing.resultSummary);
    return {
      clientActionId,
      status: "SYNCED",
      message: "Offline photo was already synced.",
      serverId: existing.id,
      photoId: typeof result.photoId === "string" ? result.photoId : null,
      relatedDeviceId: typeof result.deviceId === "string" ? result.deviceId : existing.entityId,
      relatedAssetTag: typeof result.assetTag === "string" ? result.assetTag : existing.entityLabel,
    };
  }

  const payload = normalizeOfflineAssetPhotoPayload(action.payload);
  const validation = validateOfflineSyncAction(action);
  if (!validation.ok) {
    return createPhotoRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: validation.message,
      resultSummary: { message: validation.message, assetTag: payload.assetTag, deviceId: payload.deviceId },
      relatedDeviceId: payload.deviceId,
      relatedAssetTag: payload.assetTag,
      conflictCode: "INVALID_PAYLOAD",
    });
  }

  if (!canPerformAction(actor, "inventory.write")) {
    return createPhotoRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "You no longer have permission to upload asset photos.",
      resultSummary: { message: "Permission denied at sync time.", assetTag: payload.assetTag, deviceId: payload.deviceId },
      relatedDeviceId: payload.deviceId,
      relatedAssetTag: payload.assetTag,
      conflictCode: "PERMISSION_DENIED",
    });
  }

  const device = await client.device.findFirst({
    where: {
      OR: [
        ...(payload.deviceId ? [{ id: payload.deviceId }] : []),
        ...(payload.assetTag ? [{ assetTag: payload.assetTag }] : []),
      ],
    },
    select: { id: true, assetTag: true, name: true, status: true },
  });
  if (!device) {
    return createPhotoRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Asset could not be found during photo sync.",
      resultSummary: { message: "Asset missing at sync time.", assetTag: payload.assetTag, deviceId: payload.deviceId },
      relatedDeviceId: payload.deviceId,
      relatedAssetTag: payload.assetTag,
      conflictCode: "ASSET_NOT_FOUND",
    });
  }

  const related = { relatedDeviceId: device.id, relatedAssetTag: device.assetTag };
  const entity = { entityType: "device", entityId: device.id, entityLabel: device.assetTag || device.name };
  if (["RETIRED", "DISPOSED"].includes(device.status)) {
    return createPhotoRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: `Asset is ${device.status.replaceAll("_", " ")} and the photo was not uploaded.`,
      resultSummary: { message: "Blocked retired/decommissioned asset photo upload.", currentStatus: device.status },
      ...related,
      ...entity,
      conflictCode: "ASSET_RETIRED_OR_DECOMMISSIONED",
    });
  }

  if (!input.file) {
    return createPhotoRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Local photo file is no longer available. Cancel and retake the photo on the original device.",
      resultSummary: { message: "Missing local IndexedDB photo blob.", fileName: payload.fileName, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes },
      ...related,
      ...entity,
      conflictCode: "INVALID_PAYLOAD",
    });
  }

  if (payload.mimeType && input.file.type !== payload.mimeType) {
    return createPhotoRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: "Offline photo metadata does not match the queued local file.",
      resultSummary: { message: "Mismatched photo MIME type.", expectedMimeType: payload.mimeType, actualMimeType: input.file.type },
      ...related,
      ...entity,
      conflictCode: "INVALID_PAYLOAD",
    });
  }

  await client.offlineSyncRecord.upsert({
    where: { clientActionId },
    create: {
      clientActionId,
      actionType: "UPLOAD_ASSET_PHOTO",
      status: "SYNCING",
      resolutionStatus: "OPEN",
      actorUserId: actor.id,
      actorName: actor.name,
      entityType: "device",
      entityId: device.id,
      entityLabel: device.assetTag || device.name,
      payloadSummary: summarizeOfflinePayload(action.payload),
      resultSummary: safeJsonStringify({ message: "Offline photo upload started.", fileName: payload.fileName, sizeBytes: payload.sizeBytes }),
      processedAt: new Date(),
    },
    update: {
      status: "SYNCING",
      actorUserId: actor.id,
      actorName: actor.name,
      entityType: "device",
      entityId: device.id,
      entityLabel: device.assetTag || device.name,
      payloadSummary: summarizeOfflinePayload(action.payload),
      resultSummary: safeJsonStringify({ message: "Offline photo upload started.", fileName: payload.fileName, sizeBytes: payload.sizeBytes }),
      processedAt: new Date(),
    },
  });

  const upload = await createAssetPhotoUpload({
    assetId: device.id,
    file: input.file,
    actor,
    photoType: payload.photoType,
    caption: payload.caption,
    source: payload.source || "UNKNOWN",
    compressionApplied: payload.compressionApplied,
    isPrimary: payload.isPrimary,
    clientActionId,
    offlineSync: true,
    client,
  });
  if (!upload.ok) {
    return createPhotoRecordResult({
      client,
      action,
      actor,
      status: "CONFLICT",
      message: upload.message,
      resultSummary: { message: upload.message, fileName: payload.fileName, mimeType: payload.mimeType, sizeBytes: payload.sizeBytes },
      ...related,
      ...entity,
      conflictCode: "INVALID_PAYLOAD",
    });
  }

  const record = await client.offlineSyncRecord.update({
    where: { clientActionId },
    data: {
      status: "SYNCED",
      resolutionStatus: "RESOLVED",
      conflictCode: null,
      actorUserId: actor.id,
      actorName: actor.name,
      entityType: "device",
      entityId: device.id,
      entityLabel: device.assetTag || device.name,
      payloadSummary: summarizeOfflinePayload(action.payload),
      resultSummary: safeJsonStringify({
        message: "Offline photo uploaded.",
        deviceId: device.id,
        assetTag: device.assetTag,
        photoId: upload.photo.id,
        fileName: payload.fileName,
        sizeBytes: input.file.size,
      }),
      processedAt: new Date(),
    },
  });

  return {
    clientActionId,
    status: "SYNCED",
    message: `Uploaded offline photo for ${device.assetTag || device.name}.`,
    serverId: record.id,
    photoId: upload.photo.id,
    relatedDeviceId: device.id,
    relatedAssetTag: device.assetTag,
  };
}

async function createPhotoRecordResult({
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
  const clientActionId = typeof action.clientActionId === "string" && action.clientActionId.trim() ? action.clientActionId.trim() : `invalid-photo-${Date.now()}`;
  const record = await client.offlineSyncRecord.upsert({
    where: { clientActionId },
    create: {
      clientActionId,
      actionType: "UPLOAD_ASSET_PHOTO",
      status,
      resolutionStatus: "OPEN",
      actorUserId: actor.id,
      actorName: actor.name,
      conflictCode: conflictCode ?? "UNKNOWN_SYNC_ERROR",
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
      conflictCode: conflictCode ?? "UNKNOWN_SYNC_ERROR",
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
      action: status === "CONFLICT" ? "offline.photo_upload.conflict_created" : "offline.photo_upload.failed",
      entity: "offline_sync_record",
      entityId: record.id,
      message: `Offline photo upload ${status.toLowerCase()} for review.`,
      metadata: safeJsonStringify({ clientActionId, conflictCode: conflictCode ?? "UNKNOWN_SYNC_ERROR", entityType: entityType ?? null, entityId: entityId ?? relatedDeviceId ?? null, entityLabel: entityLabel ?? relatedAssetTag ?? null }),
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

function parseResult(value: string | null) {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
