export const offlineQueueSchemaVersion = 1;
export const offlineQueueStorageKey = "warehouse-it-offline-queue-v1";

export const offlineActionTypes = ["TEST_OFFLINE_NOTE", "MOVE_ASSET", "CREATE_TASK", "CREATE_MAINTENANCE_RECORD", "UPLOAD_ASSET_PHOTO"] as const;
export type OfflineActionType = (typeof offlineActionTypes)[number];

export const offlineQueueStatuses = ["PENDING", "SYNCING", "SYNCED", "FAILED", "CONFLICT", "CANCELLED"] as const;
export type OfflineQueueStatus = (typeof offlineQueueStatuses)[number];

export type QueuedOfflineAction = {
  clientActionId: string;
  actionType: OfflineActionType;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: OfflineQueueStatus;
  attempts: number;
  lastError?: string | null;
  serverResult?: OfflineSyncActionResult | null;
  userId?: string | null;
  appVersion?: string | null;
  schemaVersion: number;
  lastKnownEntityVersion?: string | null;
};

export type OfflineSyncActionResult = {
  clientActionId: string;
  status: Extract<OfflineQueueStatus, "SYNCED" | "FAILED" | "CONFLICT">;
  message: string;
  serverId?: string;
  photoId?: string | null;
  relatedDeviceId?: string | null;
  relatedAssetTag?: string | null;
  conflict?: {
    reason: string;
    details?: string;
  };
};

export type OfflineSyncRequestAction = {
  clientActionId: string;
  actionType: string;
  payload?: unknown;
  createdAt?: string;
  schemaVersion?: number;
  lastKnownEntityVersion?: string | null;
};

const maxClientActionIdLength = 96;
const maxNoteLength = 500;
const maxOfflineMoveTextLength = 120;
const maxOfflineMoveNotesLength = 500;
const maxOfflinePhotoTextLength = 120;
const maxOfflinePhotoCaptionLength = 500;
export const maxOfflineAssetPhotoBytes = 8 * 1024 * 1024;
export const offlineAssetPhotoMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
const maxSummaryLength = 1000;
const sensitiveKeyPattern = /(bitlocker|recovery|password|passwd|secret|token|credential|smtp|private.?key|api.?key|auth|session|cookie)/i;
const bitLockerKeyPattern = /\b\d{6}(?:-\d{6}){7}\b/;
const secretLikeValuePattern = /(BEGIN (?:RSA |EC |OPENSSH |PRIVATE )?KEY|smtp_pass|bitlocker_vault_secret|password\s*=|secret\s*=|token\s*=)/i;

export function isOfflineActionType(value: unknown): value is OfflineActionType {
  return typeof value === "string" && (offlineActionTypes as readonly string[]).includes(value);
}

export type NormalizedOfflineMovePayload = {
  deviceId: string | null;
  assetTag: string | null;
  targetMapAnchorId: string | null;
  targetLocationLabel: string | null;
  targetArea: string | null;
  targetDepartment: string | null;
  targetStation: string | null;
  notes: string | null;
  movedAtClient: string | null;
  lastKnownDeviceStatus: string | null;
  lastKnownAssignmentId: string | null;
  hasLastKnownAssignmentId: boolean;
  lastKnownMapAnchorId: string | null;
  hasLastKnownMapAnchorId: boolean;
  clientRoute: string | null;
};

export type NormalizedOfflineAssetPhotoPayload = {
  deviceId: string | null;
  assetTag: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  photoType: string | null;
  caption: string | null;
  source: string | null;
  compressionApplied: boolean;
  isPrimary: boolean;
  capturedAtClient: string | null;
  lastKnownDeviceStatus: string | null;
  lastKnownAssignmentId: string | null;
  clientRoute: string | null;
};

export function isSupportedOfflineActionType(value: unknown): value is "TEST_OFFLINE_NOTE" | "MOVE_ASSET" | "UPLOAD_ASSET_PHOTO" {
  return value === "TEST_OFFLINE_NOTE" || value === "MOVE_ASSET" || value === "UPLOAD_ASSET_PHOTO";
}

export function createClientActionId(now: Date = new Date(), random = Math.random()) {
  return `offline-${now.getTime().toString(36)}-${Math.floor(random * 1_000_000).toString(36)}`;
}

export function normalizeTestOfflineNotePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { text: "", route: "" };
  const record = payload as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim().slice(0, maxNoteLength) : "";
  const route = typeof record.route === "string" ? record.route.trim().slice(0, 200) : "";
  const timestamp = typeof record.timestamp === "string" ? record.timestamp.trim().slice(0, 80) : undefined;
  return { text, route, timestamp };
}

export function normalizeOfflineMovePayload(payload: unknown): NormalizedOfflineMovePayload {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const hasLastKnownAssignmentId = Object.prototype.hasOwnProperty.call(record, "lastKnownAssignmentId");
  const hasLastKnownMapAnchorId = Object.prototype.hasOwnProperty.call(record, "lastKnownMapAnchorId");
  return {
    deviceId: cleanMoveText(record.deviceId, 96),
    assetTag: cleanMoveText(record.assetTag, 96),
    targetMapAnchorId: cleanMoveText(record.targetMapAnchorId ?? record.mapAnchorId, 96),
    targetLocationLabel: cleanMoveText(record.targetLocationLabel ?? record.location, maxOfflineMoveTextLength),
    targetArea: cleanMoveText(record.targetArea ?? record.area, maxOfflineMoveTextLength),
    targetDepartment: cleanMoveText(record.targetDepartment ?? record.department, maxOfflineMoveTextLength),
    targetStation: cleanMoveText(record.targetStation ?? record.station, maxOfflineMoveTextLength),
    notes: cleanMoveText(record.notes, maxOfflineMoveNotesLength),
    movedAtClient: cleanMoveText(record.movedAtClient, 80),
    lastKnownDeviceStatus: cleanMoveText(record.lastKnownDeviceStatus, 80),
    lastKnownAssignmentId: cleanMoveText(record.lastKnownAssignmentId, 96),
    hasLastKnownAssignmentId,
    lastKnownMapAnchorId: cleanMoveText(record.lastKnownMapAnchorId, 96),
    hasLastKnownMapAnchorId,
    clientRoute: cleanMoveText(record.clientRoute, 200),
  };
}

export function normalizeOfflineAssetPhotoPayload(payload: unknown): NormalizedOfflineAssetPhotoPayload {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  return {
    deviceId: cleanMoveText(record.deviceId, 96),
    assetTag: cleanMoveText(record.assetTag, 96),
    fileName: cleanMoveText(record.fileName, maxOfflinePhotoTextLength),
    mimeType: cleanMoveText(record.mimeType, 80),
    sizeBytes: cleanNumber(record.sizeBytes),
    photoType: cleanMoveText(record.photoType, 80),
    caption: cleanMoveText(record.caption, maxOfflinePhotoCaptionLength),
    source: cleanMoveText(record.source, 40),
    compressionApplied: record.compressionApplied === true || record.compressionApplied === "true",
    isPrimary: record.isPrimary === true || record.isPrimary === "true",
    capturedAtClient: cleanMoveText(record.capturedAtClient, 80),
    lastKnownDeviceStatus: cleanMoveText(record.lastKnownDeviceStatus, 80),
    lastKnownAssignmentId: cleanMoveText(record.lastKnownAssignmentId, 96),
    clientRoute: cleanMoveText(record.clientRoute, 200),
  };
}

export function validateOfflineActionForQueue(input: { actionType: unknown; payload: unknown }) {
  if (!isOfflineActionType(input.actionType)) return { ok: false as const, message: "Unsupported offline action type." };
  const sensitive = findSensitivePayloadIssue(input.payload);
  if (sensitive) return { ok: false as const, message: sensitive };
  if (input.actionType === "TEST_OFFLINE_NOTE") {
    const note = normalizeTestOfflineNotePayload(input.payload);
    if (!note.text) return { ok: false as const, message: "Test note text is required." };
  }
  if (input.actionType === "MOVE_ASSET") {
    const move = normalizeOfflineMovePayload(input.payload);
    if (!move.deviceId && !move.assetTag) return { ok: false as const, message: "Asset tag or device ID is required for an offline move." };
    if (!move.targetMapAnchorId && !move.targetLocationLabel && !move.targetArea && !move.targetDepartment && !move.targetStation) {
      return { ok: false as const, message: "Target location, area, station, or map anchor is required for an offline move." };
    }
  }
  if (input.actionType === "UPLOAD_ASSET_PHOTO") {
    const photo = normalizeOfflineAssetPhotoPayload(input.payload);
    const validation = validateOfflineAssetPhotoPayload(photo);
    if (!validation.ok) return validation;
  }
  return { ok: true as const };
}

export function validateOfflineSyncAction(input: OfflineSyncRequestAction) {
  if (!input || typeof input !== "object") return { ok: false as const, message: "Queued action is invalid." };
  if (typeof input.clientActionId !== "string" || !input.clientActionId.trim()) return { ok: false as const, message: "Queued action is missing a client action ID." };
  if (input.clientActionId.length > maxClientActionIdLength) return { ok: false as const, message: "Queued action ID is too long." };
  if (!isOfflineActionType(input.actionType)) return { ok: false as const, message: "Offline action type is not recognized." };
  const sensitive = findSensitivePayloadIssue(input.payload);
  if (sensitive) return { ok: false as const, message: sensitive };
  if (!isSupportedOfflineActionType(input.actionType)) return { ok: false as const, message: "This action type is not supported offline yet." };
  if (input.actionType === "UPLOAD_ASSET_PHOTO") {
    const photo = normalizeOfflineAssetPhotoPayload(input.payload);
    return validateOfflineAssetPhotoPayload(photo);
  }
  if (input.actionType === "MOVE_ASSET") {
    const move = normalizeOfflineMovePayload(input.payload);
    if (!move.deviceId && !move.assetTag) return { ok: false as const, message: "Asset tag or device ID is required for an offline move." };
    if (!move.targetMapAnchorId && !move.targetLocationLabel && !move.targetArea && !move.targetDepartment && !move.targetStation) {
      return { ok: false as const, message: "Target location, area, station, or map anchor is required for an offline move." };
    }
    return { ok: true as const };
  }
  const note = normalizeTestOfflineNotePayload(input.payload);
  if (!note.text) return { ok: false as const, message: "Test note text is required." };
  return { ok: true as const };
}

export function summarizeQueuedOfflineAction(action: Pick<QueuedOfflineAction, "actionType" | "payload">) {
  if (action.actionType === "MOVE_ASSET") {
    const move = normalizeOfflineMovePayload(action.payload);
    return {
      title: `Move ${move.assetTag || move.deviceId || "asset"}`,
      detail: move.targetLocationLabel || [move.targetArea, move.targetDepartment, move.targetStation].filter(Boolean).join(" / ") || (move.targetMapAnchorId ? "Map anchor destination" : "No destination"),
      note: move.notes,
      relatedAssetTag: move.assetTag,
      relatedDeviceId: move.deviceId,
    };
  }
  if (action.actionType === "TEST_OFFLINE_NOTE") {
    const note = normalizeTestOfflineNotePayload(action.payload);
    return { title: "Test offline note", detail: note.text || "Queued test note", note: note.route || null, relatedAssetTag: null, relatedDeviceId: null };
  }
  if (action.actionType === "UPLOAD_ASSET_PHOTO") {
    const photo = normalizeOfflineAssetPhotoPayload(action.payload);
    return {
      title: `Photo for ${photo.assetTag || photo.deviceId || "asset"}`,
      detail: [photo.fileName, photo.sizeBytes ? formatBytes(photo.sizeBytes) : null].filter(Boolean).join(" - ") || "Queued asset photo",
      note: [photo.photoType, photo.caption].filter(Boolean).join(" - ") || null,
      relatedAssetTag: photo.assetTag,
      relatedDeviceId: photo.deviceId,
    };
  }
  return { title: action.actionType.replaceAll("_", " "), detail: "Future offline action", note: null, relatedAssetTag: null, relatedDeviceId: null };
}

export function findSensitivePayloadIssue(value: unknown): string | null {
  const stack: Array<{ value: unknown; path: string }> = [{ value, path: "payload" }];
  const seen = new Set<unknown>();

  while (stack.length) {
    const item = stack.pop()!;
    if (item.value && typeof item.value === "object") {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      if (Array.isArray(item.value)) {
        item.value.forEach((child, index) => stack.push({ value: child, path: `${item.path}[${index}]` }));
      } else {
        for (const [key, child] of Object.entries(item.value as Record<string, unknown>)) {
          if (sensitiveKeyPattern.test(key)) return `Offline queue rejected sensitive field "${key}".`;
          stack.push({ value: child, path: `${item.path}.${key}` });
        }
      }
      continue;
    }

    if (typeof item.value === "string") {
      if (bitLockerKeyPattern.test(item.value)) return "Offline queue rejected a BitLocker recovery-key-like value.";
      if (secretLikeValuePattern.test(item.value)) return "Offline queue rejected secret-looking text.";
    }
  }

  return null;
}

export function summarizeOfflinePayload(payload: unknown) {
  if (findSensitivePayloadIssue(payload)) return "[rejected sensitive payload]";
  const redacted = redactForSummary(payload);
  const summary = safeJsonStringify(redacted);
  return summary.length > maxSummaryLength ? `${summary.slice(0, maxSummaryLength - 3)}...` : summary;
}

export function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "\"[unserializable payload]\"";
  }
}

function redactForSummary(value: unknown): unknown {
  if (typeof value === "string") {
    if (bitLockerKeyPattern.test(value) || secretLikeValuePattern.test(value)) return "[redacted]";
    return value.length > 500 ? `${value.slice(0, 497)}...` : value;
  }
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactForSummary(item));
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sensitiveKeyPattern.test(key) ? "[redacted]" : redactForSummary(child);
  }
  return output;
}

function cleanMoveText(value: unknown, maxLength = maxOfflineMoveTextLength) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function validateOfflineAssetPhotoPayload(photo: NormalizedOfflineAssetPhotoPayload) {
  if (!photo.deviceId && !photo.assetTag) return { ok: false as const, message: "Asset tag or device ID is required for an offline photo." };
  if (!photo.fileName) return { ok: false as const, message: "Photo file name is required for offline photo sync." };
  if (!photo.mimeType || !(offlineAssetPhotoMimeTypes as readonly string[]).includes(photo.mimeType)) return { ok: false as const, message: "Offline photo type must be JPEG, PNG, WebP, HEIC, or HEIF." };
  if (!photo.sizeBytes || photo.sizeBytes <= 0) return { ok: false as const, message: "Offline photo file is empty." };
  if (photo.sizeBytes > maxOfflineAssetPhotoBytes) return { ok: false as const, message: `Offline photo is too large. Max size is ${Math.floor(maxOfflineAssetPhotoBytes / 1024 / 1024)} MB.` };
  return { ok: true as const };
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
