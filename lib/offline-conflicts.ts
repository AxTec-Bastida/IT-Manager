import type { OfflineActionType, OfflineResolutionStatus, OfflineSyncRecord, OfflineSyncStatus, Prisma, PrismaClient } from "@prisma/client";
import { ClientInputError } from "@/lib/api";
import { canPerformAction, makeActivityActor, type AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findSensitivePayloadIssue, safeJsonStringify, type OfflineSyncRequestAction } from "@/lib/offline-actions";
import { processOfflineSyncBatch } from "@/lib/offline-sync";

export const offlineConflictCodes = [
  "ASSET_NOT_FOUND",
  "ASSET_RETIRED_OR_DECOMMISSIONED",
  "PERMISSION_DENIED",
  "TARGET_LOCATION_NOT_FOUND",
  "STALE_LOCATION",
  "STALE_ASSIGNMENT",
  "INVALID_PAYLOAD",
  "UNSUPPORTED_ACTION",
  "SERVER_VALIDATION_WARNING",
  "UNKNOWN_SYNC_ERROR",
] as const;

export type OfflineConflictCode = (typeof offlineConflictCodes)[number];

export const offlineConflictInfo: Record<OfflineConflictCode, { title: string; explanation: string; recommendedAction: string; tone: "amber" | "red" | "slate" }> = {
  ASSET_NOT_FOUND: {
    title: "Asset not found",
    explanation: "The queued action referenced an asset tag or device ID the server could not match.",
    recommendedAction: "Search inventory, confirm the label, then cancel or create a manual review task.",
    tone: "red",
  },
  ASSET_RETIRED_OR_DECOMMISSIONED: {
    title: "Asset is retired, lost, or disposed",
    explanation: "The server blocked the offline move because the current asset status should not be moved automatically.",
    recommendedAction: "Open the asset and confirm lifecycle status before any manual correction.",
    tone: "red",
  },
  PERMISSION_DENIED: {
    title: "Permission denied",
    explanation: "The syncing user no longer had permission to apply this offline action.",
    recommendedAction: "Have IT Staff or Admin review the action and retry only if the move is still valid.",
    tone: "amber",
  },
  TARGET_LOCATION_NOT_FOUND: {
    title: "Target location no longer exists",
    explanation: "The queued destination map anchor was missing or inactive when the action synced.",
    recommendedAction: "Choose a current location and queue a fresh move if needed.",
    tone: "amber",
  },
  STALE_LOCATION: {
    title: "Asset location changed",
    explanation: "The asset changed location or status after the offline action was queued.",
    recommendedAction: "Compare the queued destination with the current asset page before retrying.",
    tone: "amber",
  },
  STALE_ASSIGNMENT: {
    title: "Assignment changed",
    explanation: "The asset assignment changed after the offline action was queued.",
    recommendedAction: "Open the asset and assignment record, then retry only if the move still makes sense.",
    tone: "amber",
  },
  INVALID_PAYLOAD: {
    title: "Invalid queued action",
    explanation: "The queued action was malformed, incomplete, or rejected by offline safety checks.",
    recommendedAction: "Cancel this record and queue a new action from the app.",
    tone: "red",
  },
  UNSUPPORTED_ACTION: {
    title: "Unsupported offline action",
    explanation: "Only test notes, serialized asset moves, and asset photo uploads are supported offline right now.",
    recommendedAction: "Use the online workflow for stock, RMA, decommission, BitLocker, facturas, imports, or admin actions.",
    tone: "slate",
  },
  SERVER_VALIDATION_WARNING: {
    title: "Server validation needs review",
    explanation: "The server found a blocking warning and refused to auto-apply the queued action.",
    recommendedAction: "Review the warning, open the asset, and retry only after confirming the current state.",
    tone: "amber",
  },
  UNKNOWN_SYNC_ERROR: {
    title: "Unknown sync error",
    explanation: "The server could not classify this failure into a known offline conflict category.",
    recommendedAction: "Review the technical details and create a task if the cause is not obvious.",
    tone: "red",
  },
};

export type SanitizedOfflineConflictRecord = {
  id: string;
  clientActionId: string;
  actionType: OfflineActionType;
  status: OfflineSyncStatus;
  resolutionStatus: OfflineResolutionStatus;
  conflictCode: OfflineConflictCode;
  conflictTitle: string;
  explanation: string;
  recommendedAction: string;
  actorName: string | null;
  actorUserId: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  payloadSummaryText: string | null;
  resultSummaryText: string | null;
  createdAt: string;
  processedAt: string | null;
};

type OfflineRecordForReview = OfflineSyncRecord & {
  actorUser?: { id: string; name: string; role: string } | null;
  reviewedByUser?: { id: string; name: string; role: string } | null;
};

export function canReadOfflineConflicts(user: Pick<AuthUser, "role" | "isActive"> | null | undefined) {
  return canPerformAction(user, "inventory.read") || canPerformAction(user, "audits.read");
}

export function canMutateOfflineConflicts(user: Pick<AuthUser, "role" | "isActive"> | null | undefined) {
  return Boolean(user?.isActive && (user.role === "ADMIN" || user.role === "IT_STAFF"));
}

export function normalizeOfflineConflictCode(value: unknown): OfflineConflictCode {
  return typeof value === "string" && (offlineConflictCodes as readonly string[]).includes(value) ? (value as OfflineConflictCode) : "UNKNOWN_SYNC_ERROR";
}

export function inferOfflineConflictCode(message: string, actionType?: string | null): OfflineConflictCode {
  const text = `${actionType ?? ""} ${message}`.toLowerCase();
  if (text.includes("not supported offline")) return "UNSUPPORTED_ACTION";
  if (text.includes("permission denied") || text.includes("permission")) return "PERMISSION_DENIED";
  if (text.includes("asset could not be found") || text.includes("asset missing")) return "ASSET_NOT_FOUND";
  if (text.includes("retired") || text.includes("disposed") || text.includes("lost")) return "ASSET_RETIRED_OR_DECOMMISSIONED";
  if (text.includes("target location anchor") || text.includes("invalid target map anchor")) return "TARGET_LOCATION_NOT_FOUND";
  if (text.includes("assignment changed") || text.includes("stale assignment")) return "STALE_ASSIGNMENT";
  if (text.includes("location changed") || text.includes("map location changed") || text.includes("stale map") || text.includes("status changed")) return "STALE_LOCATION";
  if (text.includes("validation") || text.includes("warning") || text.includes("needs review")) return "SERVER_VALIDATION_WARNING";
  if (text.includes("invalid") || text.includes("malformed") || text.includes("missing") || text.includes("sensitive") || text.includes("secret") || text.includes("bitlocker")) return "INVALID_PAYLOAD";
  return "UNKNOWN_SYNC_ERROR";
}

export function parseSafeSummary(value: string | null | undefined): Record<string, unknown> | null {
  if (!value || value === "[rejected sensitive payload]") return null;
  if (findSensitivePayloadIssue(value)) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (findSensitivePayloadIssue(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function sanitizeOfflineConflictRecord(record: OfflineRecordForReview): SanitizedOfflineConflictRecord {
  const result = parseSafeSummary(record.resultSummary);
  const payload = parseSafeSummary(record.payloadSummary);
  const inferredFromResult = typeof result?.message === "string" ? result.message : record.resultSummary ?? "";
  const code = typeof record.conflictCode === "string" && (offlineConflictCodes as readonly string[]).includes(record.conflictCode)
    ? (record.conflictCode as OfflineConflictCode)
    : inferOfflineConflictCode(inferredFromResult, record.actionType);
  const info = offlineConflictInfo[code];
  return {
    id: record.id,
    clientActionId: record.clientActionId,
    actionType: record.actionType,
    status: record.status,
    resolutionStatus: record.resolutionStatus,
    conflictCode: code,
    conflictTitle: info.title,
    explanation: info.explanation,
    recommendedAction: info.recommendedAction,
    actorName: record.actorName || record.actorUser?.name || null,
    actorUserId: record.actorUserId,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewedByName: record.reviewedByUser?.name ?? null,
    reviewedByUserId: record.reviewedByUserId,
    reviewNote: record.reviewNote,
    entityType: record.entityType,
    entityId: record.entityId,
    entityLabel: record.entityLabel,
    payload,
    result,
    payloadSummaryText: safeSummaryText(record.payloadSummary),
    resultSummaryText: safeSummaryText(record.resultSummary),
    createdAt: record.createdAt.toISOString(),
    processedAt: record.processedAt?.toISOString() ?? null,
  };
}

export function buildOfflineConflictWhere(params: URLSearchParams | { get(name: string): string | null }): Prisma.OfflineSyncRecordWhereInput {
  const status = cleanFilter(params.get("status"));
  const resolution = cleanFilter(params.get("resolution"));
  const actionType = cleanFilter(params.get("actionType"));
  const q = cleanFilter(params.get("q"));
  const code = cleanFilter(params.get("code"));
  const where: Prisma.OfflineSyncRecordWhereInput = {};

  if (status) {
    where.status = status as OfflineSyncStatus;
  } else if (!resolution) {
    where.OR = [{ status: { in: ["FAILED", "CONFLICT"] } }, { resolutionStatus: { in: ["OPEN", "REVIEWED", "RETRIED", "CANCELLED"] } }];
  }

  if (resolution) where.resolutionStatus = resolution as OfflineResolutionStatus;
  if (actionType) where.actionType = actionType as OfflineActionType;
  if (code) where.conflictCode = code;
  if (q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { clientActionId: { contains: q } },
          { actorName: { contains: q } },
          { entityLabel: { contains: q } },
          { payloadSummary: { contains: q } },
          { resultSummary: { contains: q } },
        ],
      },
    ];
  }

  return where;
}

export async function getOfflineConflictRecords({
  searchParams,
  limit = 50,
  client = prisma,
}: {
  searchParams?: URLSearchParams | { get(name: string): string | null };
  limit?: number;
  client?: PrismaClient;
}) {
  const params = searchParams ?? new URLSearchParams();
  const boundedLimit = Math.min(Math.max(Number(params.get("limit") ?? limit) || limit, 1), 100);
  const records = await client.offlineSyncRecord.findMany({
    where: buildOfflineConflictWhere(params),
    orderBy: [{ processedAt: "desc" }, { createdAt: "desc" }],
    take: boundedLimit,
    include: {
      actorUser: { select: { id: true, name: true, role: true } },
      reviewedByUser: { select: { id: true, name: true, role: true } },
    },
  });
  return records.map((record) => sanitizeOfflineConflictRecord(record as OfflineRecordForReview));
}

export async function getOfflineConflictHealth(client: PrismaClient = prisma, now = new Date()) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [openConflicts, failedRecords, reviewedResolved, lastSevenDays, oldestOpen] = await Promise.all([
    client.offlineSyncRecord.count({ where: { resolutionStatus: "OPEN", status: { in: ["FAILED", "CONFLICT"] } } }),
    client.offlineSyncRecord.count({ where: { status: "FAILED", resolutionStatus: { not: "CANCELLED" } } }),
    client.offlineSyncRecord.count({ where: { resolutionStatus: { in: ["REVIEWED", "RESOLVED", "CANCELLED"] } } }),
    client.offlineSyncRecord.count({ where: { status: { in: ["FAILED", "CONFLICT"] }, createdAt: { gte: sevenDaysAgo } } }),
    client.offlineSyncRecord.findFirst({
      where: { resolutionStatus: "OPEN", status: { in: ["FAILED", "CONFLICT"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, clientActionId: true, actionType: true, status: true, conflictCode: true, resultSummary: true, entityLabel: true, actorName: true, createdAt: true, processedAt: true },
    }),
  ]);
  const oldestCode = oldestOpen
    ? typeof oldestOpen.conflictCode === "string" && (offlineConflictCodes as readonly string[]).includes(oldestOpen.conflictCode)
      ? (oldestOpen.conflictCode as OfflineConflictCode)
      : inferOfflineConflictCode(typeof parseSafeSummary(oldestOpen.resultSummary)?.message === "string" ? String(parseSafeSummary(oldestOpen.resultSummary)?.message) : oldestOpen.resultSummary ?? "", oldestOpen.actionType)
    : null;

  return {
    openConflicts,
    failedRecords,
    reviewedResolved,
    conflictsLast7Days: lastSevenDays,
    oldestOpen: oldestOpen
      ? {
          id: oldestOpen.id,
          clientActionId: oldestOpen.clientActionId,
          actionType: oldestOpen.actionType,
          status: oldestOpen.status,
          conflictCode: oldestCode ?? "UNKNOWN_SYNC_ERROR",
          entityLabel: oldestOpen.entityLabel,
          actorName: oldestOpen.actorName,
          title: offlineConflictInfo[oldestCode ?? "UNKNOWN_SYNC_ERROR"].title,
          createdAt: oldestOpen.createdAt.toISOString(),
          processedAt: oldestOpen.processedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function markOfflineConflictReviewed(id: string, actor: AuthUser, note: string | null, client: PrismaClient = prisma) {
  if (!canMutateOfflineConflicts(actor)) throw new ClientInputError("You do not have permission to review offline conflicts.", 403);
  const existing = await client.offlineSyncRecord.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ClientInputError("Offline sync record not found.", 404);
  const reviewNote = cleanNote(note);
  return client.$transaction(async (tx) => {
    const record = await tx.offlineSyncRecord.update({
      where: { id },
      data: {
        resolutionStatus: "REVIEWED",
        reviewedAt: new Date(),
        reviewedByUserId: actor.id,
        reviewNote,
      },
      include: { actorUser: { select: { id: true, name: true, role: true } }, reviewedByUser: { select: { id: true, name: true, role: true } } },
    });
    await tx.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "offline.conflict.reviewed",
        entity: "offline_sync_record",
        entityId: record.id,
        message: `Offline ${record.actionType} conflict marked reviewed by ${actor.name}.`,
        metadata: safeJsonStringify({ clientActionId: record.clientActionId, conflictCode: record.conflictCode, notePresent: Boolean(reviewNote) }),
      },
    });
    return sanitizeOfflineConflictRecord(record as OfflineRecordForReview);
  });
}

export async function cancelOfflineConflict(id: string, actor: AuthUser, note: string | null, client: PrismaClient = prisma) {
  if (!canMutateOfflineConflicts(actor)) throw new ClientInputError("You do not have permission to cancel offline conflicts.", 403);
  const existing = await client.offlineSyncRecord.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ClientInputError("Offline sync record not found.", 404);
  const reviewNote = cleanNote(note);
  return client.$transaction(async (tx) => {
    const record = await tx.offlineSyncRecord.update({
      where: { id },
      data: {
        status: "CANCELLED",
        resolutionStatus: "CANCELLED",
        reviewedAt: new Date(),
        reviewedByUserId: actor.id,
        reviewNote,
        processedAt: new Date(),
      },
      include: { actorUser: { select: { id: true, name: true, role: true } }, reviewedByUser: { select: { id: true, name: true, role: true } } },
    });
    await tx.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "offline.conflict.cancelled",
        entity: "offline_sync_record",
        entityId: record.id,
        message: `Offline ${record.actionType} conflict cancelled by ${actor.name}.`,
        metadata: safeJsonStringify({ clientActionId: record.clientActionId, conflictCode: record.conflictCode, notePresent: Boolean(reviewNote) }),
      },
    });
    return sanitizeOfflineConflictRecord(record as OfflineRecordForReview);
  });
}

export async function retryOfflineConflict(id: string, actor: AuthUser, client: PrismaClient = prisma) {
  if (!canMutateOfflineConflicts(actor)) throw new ClientInputError("You do not have permission to retry offline conflicts.", 403);
  const record = await client.offlineSyncRecord.findUnique({ where: { id } });
  if (!record) throw new ClientInputError("Offline sync record not found.", 404);
  if (!["FAILED", "CONFLICT"].includes(record.status)) throw new ClientInputError("Only failed or conflicted offline actions can be retried.");
  if (record.resolutionStatus === "CANCELLED" || record.status === "CANCELLED") throw new ClientInputError("Cancelled offline actions cannot be retried.");
  if (record.actionType === "UPLOAD_ASSET_PHOTO") throw new ClientInputError("Offline photo uploads must be retried from the Offline Queue on the original browser/device so the local photo file can be sent.", 422);

  const action = reconstructOfflineAction(record);
  await client.offlineSyncRecord.update({
    where: { id },
    data: { resolutionStatus: "RETRIED", reviewedAt: new Date(), reviewedByUserId: actor.id },
  });
  await client.activityLog.create({
    data: {
      ...makeActivityActor(actor),
      action: "offline.conflict.retry_attempted",
      entity: "offline_sync_record",
      entityId: record.id,
      message: `Offline ${record.actionType} conflict retry attempted by ${actor.name}.`,
      metadata: safeJsonStringify({ clientActionId: record.clientActionId, conflictCode: record.conflictCode }),
    },
  });

  const result = await processOfflineSyncBatch([action], actor, client);
  const updated = await client.offlineSyncRecord.findUnique({
    where: { id },
    include: { actorUser: { select: { id: true, name: true, role: true } }, reviewedByUser: { select: { id: true, name: true, role: true } } },
  });
  return { result: result.results[0], record: updated ? sanitizeOfflineConflictRecord(updated as OfflineRecordForReview) : null };
}

export function reconstructOfflineAction(record: Pick<OfflineSyncRecord, "clientActionId" | "actionType" | "payloadSummary">): OfflineSyncRequestAction {
  const payload = parseSafeSummary(record.payloadSummary);
  if (!payload) throw new ClientInputError("This offline action cannot be retried because its safe payload summary is unavailable.");
  return {
    clientActionId: record.clientActionId,
    actionType: record.actionType,
    payload,
    schemaVersion: 1,
  };
}

function safeSummaryText(value: string | null | undefined) {
  if (!value || value === "[rejected sensitive payload]" || findSensitivePayloadIssue(value)) return null;
  return value.length > 2000 ? `${value.slice(0, 1997)}...` : value;
}

function cleanFilter(value: string | null) {
  const text = value?.trim();
  return text || null;
}

function cleanNote(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  return text.slice(0, 500);
}
