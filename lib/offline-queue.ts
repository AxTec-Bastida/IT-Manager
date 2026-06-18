import { createClientActionId, offlineQueueSchemaVersion, offlineQueueStorageKey, type OfflineSyncActionResult, type QueuedOfflineAction, validateOfflineActionForQueue } from "@/lib/offline-actions";
import { deleteOfflinePhotoBlob, deleteOfflinePhotoBlobs, getOfflinePhotoBlob } from "@/lib/offline-photo-blobs";

export type OfflineQueueSnapshot = {
  items: QueuedOfflineAction[];
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  syncedCount: number;
  syncingCount: number;
};

type SyncFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function readOfflineQueue(storage = getBrowserStorage()): QueuedOfflineAction[] {
  if (!storage) return [];
  const raw = storage.getItem(offlineQueueStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedOfflineAction);
  } catch {
    return [];
  }
}

export function writeOfflineQueue(items: QueuedOfflineAction[], storage = getBrowserStorage()) {
  if (!storage) return;
  storage.setItem(offlineQueueStorageKey, JSON.stringify(items));
  dispatchOfflineQueueChanged();
}

export function getOfflineQueueSnapshot(storage = getBrowserStorage()): OfflineQueueSnapshot {
  const items = readOfflineQueue(storage);
  return {
    items,
    pendingCount: items.filter((item) => item.status === "PENDING").length,
    failedCount: items.filter((item) => item.status === "FAILED").length,
    conflictCount: items.filter((item) => item.status === "CONFLICT").length,
    syncedCount: items.filter((item) => item.status === "SYNCED").length,
    syncingCount: items.filter((item) => item.status === "SYNCING").length,
  };
}

export function enqueueOfflineAction(
  input: { actionType: QueuedOfflineAction["actionType"]; payload: Record<string, unknown>; userId?: string | null; appVersion?: string | null; clientActionId?: string | null },
  storage = getBrowserStorage(),
) {
  const validation = validateOfflineActionForQueue(input);
  if (!validation.ok) throw new Error(validation.message);
  const now = new Date().toISOString();
  const action: QueuedOfflineAction = {
    clientActionId: input.clientActionId || createClientActionId(),
    actionType: input.actionType,
    payload: input.payload,
    createdAt: now,
    updatedAt: now,
    status: "PENDING",
    attempts: 0,
    lastError: null,
    serverResult: null,
    userId: input.userId ?? null,
    appVersion: input.appVersion ?? null,
    schemaVersion: offlineQueueSchemaVersion,
  };
  const items = readOfflineQueue(storage);
  writeOfflineQueue([action, ...items], storage);
  return action;
}

export function cancelOfflineAction(clientActionId: string, storage = getBrowserStorage()) {
  const now = new Date().toISOString();
  const items = readOfflineQueue(storage).map((item) => (item.clientActionId === clientActionId && item.status === "PENDING" ? { ...item, status: "CANCELLED" as const, updatedAt: now } : item));
  writeOfflineQueue(items, storage);
}

export function retryOfflineAction(clientActionId: string, storage = getBrowserStorage()) {
  const now = new Date().toISOString();
  const items = readOfflineQueue(storage).map((item) => (item.clientActionId === clientActionId && ["FAILED", "CONFLICT"].includes(item.status) ? { ...item, status: "PENDING" as const, updatedAt: now, lastError: null } : item));
  writeOfflineQueue(items, storage);
}

export function clearSyncedOfflineActions(storage = getBrowserStorage()) {
  const items = readOfflineQueue(storage);
  void deleteOfflinePhotoBlobs(items.filter((item) => item.status === "SYNCED" && item.actionType === "UPLOAD_ASSET_PHOTO").map((item) => item.clientActionId)).catch(() => undefined);
  writeOfflineQueue(items.filter((item) => item.status !== "SYNCED"), storage);
}

export async function cancelOfflineActionAndBlob(clientActionId: string, storage = getBrowserStorage()) {
  cancelOfflineAction(clientActionId, storage);
  await deleteOfflinePhotoBlob(clientActionId).catch(() => undefined);
}

export async function syncOfflineQueue(fetcher: SyncFetch = fetch, storage = getBrowserStorage()) {
  const allItems = readOfflineQueue(storage);
  const syncable = allItems.filter((item) => item.status === "PENDING" || item.status === "FAILED");
  if (!syncable.length) return { results: [] as OfflineSyncActionResult[], synced: 0, failed: 0, conflict: 0 };
  const now = new Date().toISOString();
  writeOfflineQueue(
    allItems.map((item) => (syncable.some((candidate) => candidate.clientActionId === item.clientActionId) ? { ...item, status: "SYNCING", updatedAt: now, attempts: item.attempts + 1 } : item)),
    storage,
  );

  let results: OfflineSyncActionResult[];
  try {
    const photoActions = syncable.filter((item) => item.actionType === "UPLOAD_ASSET_PHOTO");
    const metadataActions = syncable.filter((item) => item.actionType !== "UPLOAD_ASSET_PHOTO");
    const metadataResults = metadataActions.length ? await syncMetadataActions(metadataActions, fetcher) : [];
    const photoResults = photoActions.length ? await Promise.all(photoActions.map((item) => syncOfflinePhotoAction(item, fetcher))) : [];
    results = [...metadataResults, ...photoResults];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Offline sync failed.";
    const failedItems = readOfflineQueue(storage).map((item) => (syncable.some((candidate) => candidate.clientActionId === item.clientActionId) ? { ...item, status: "FAILED" as const, updatedAt: new Date().toISOString(), lastError: message } : item));
    writeOfflineQueue(failedItems, storage);
    throw error;
  }

  const resultById = new Map(results.map((result) => [result.clientActionId, result]));
  writeOfflineQueue(
    readOfflineQueue(storage).map((item) => {
      const result = resultById.get(item.clientActionId);
      if (!result) return item.status === "SYNCING" ? { ...item, status: "FAILED", updatedAt: new Date().toISOString(), lastError: "Server did not return a result for this action." } : item;
      return {
        ...item,
        status: result.status,
        updatedAt: new Date().toISOString(),
        lastError: result.status === "SYNCED" ? null : result.message,
        serverResult: result,
      };
    }),
    storage,
  );

  const syncedPhotoActionIds = results.filter((result) => result.status === "SYNCED").map((result) => result.clientActionId);
  if (syncedPhotoActionIds.length) {
    await deleteOfflinePhotoBlobs(syncedPhotoActionIds).catch(() => undefined);
  }

  return {
    results,
    synced: results.filter((result) => result.status === "SYNCED").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    conflict: results.filter((result) => result.status === "CONFLICT").length,
  };
}

async function syncMetadataActions(actions: QueuedOfflineAction[], fetcher: SyncFetch) {
  const response = await fetcher("/api/offline/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions }),
  });
  const json = (await response.json()) as { results?: OfflineSyncActionResult[]; error?: string };
  if (!response.ok) throw new Error(json.error || "Offline sync failed.");
  return Array.isArray(json.results) ? json.results : [];
}

async function syncOfflinePhotoAction(action: QueuedOfflineAction, fetcher: SyncFetch): Promise<OfflineSyncActionResult> {
  const formData = new FormData();
  formData.set("clientActionId", action.clientActionId);
  formData.set("payload", JSON.stringify(action.payload));
  formData.set("createdAt", action.createdAt);
  formData.set("schemaVersion", String(action.schemaVersion));
  const record = await getOfflinePhotoBlob(action.clientActionId).catch(() => null);
  if (record?.blob) {
    formData.set("file", record.blob, record.fileName);
  }
  const response = await fetcher("/api/offline/sync/photo", { method: "POST", body: formData });
  const json = (await response.json().catch(() => ({}))) as OfflineSyncActionResult & { error?: string };
  if (!response.ok && !json.status) {
    return {
      clientActionId: action.clientActionId,
      status: "FAILED",
      message: json.error || "Offline photo sync failed.",
    };
  }
  return {
    clientActionId: json.clientActionId || action.clientActionId,
    status: json.status || "FAILED",
    message: json.message || json.error || "Offline photo sync failed.",
    serverId: json.serverId,
    photoId: json.photoId,
    relatedDeviceId: json.relatedDeviceId,
    relatedAssetTag: json.relatedAssetTag,
    conflict: json.conflict,
  };
}

export function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isQueuedOfflineAction(value: unknown): value is QueuedOfflineAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<QueuedOfflineAction>;
  return typeof item.clientActionId === "string" && typeof item.actionType === "string" && typeof item.status === "string" && typeof item.createdAt === "string" && typeof item.updatedAt === "string" && typeof item.attempts === "number";
}

function dispatchOfflineQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}
