import type { OfflineActionType, OfflineSyncStatus, PrismaClient } from "@prisma/client";
import { makeActivityActor, type AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTestOfflineNotePayload, safeJsonStringify, summarizeOfflinePayload, type OfflineSyncActionResult, type OfflineSyncRequestAction, validateOfflineSyncAction } from "@/lib/offline-actions";

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
    const failureStatus = recognizedType && action.actionType !== "TEST_OFFLINE_NOTE" ? "CONFLICT" : "FAILED";
    return createOfflineRecordResult({
      client,
      action,
      actor,
      status: failureStatus,
      message: validation.message,
      resultSummary: { message: validation.message },
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

async function createOfflineRecordResult({
  client,
  action,
  actor,
  status,
  message,
  resultSummary,
}: {
  client: PrismaClient;
  action: OfflineSyncRequestAction;
  actor: AuthUser;
  status: Extract<OfflineSyncStatus, "FAILED" | "CONFLICT">;
  message: string;
  resultSummary: Record<string, unknown>;
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
    ...(status === "CONFLICT" ? { conflict: { reason: message } } : {}),
  };
}

function normalizeOfflineActionType(value: unknown): OfflineActionType | null {
  if (value === "TEST_OFFLINE_NOTE" || value === "MOVE_ASSET" || value === "CREATE_TASK" || value === "CREATE_MAINTENANCE_RECORD" || value === "UPLOAD_ASSET_PHOTO") return value;
  return null;
}
