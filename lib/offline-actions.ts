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
const maxSummaryLength = 1000;
const sensitiveKeyPattern = /(bitlocker|recovery|password|passwd|secret|token|credential|smtp|private.?key|api.?key|auth|session|cookie)/i;
const bitLockerKeyPattern = /\b\d{6}(?:-\d{6}){7}\b/;
const secretLikeValuePattern = /(BEGIN (?:RSA |EC |OPENSSH |PRIVATE )?KEY|smtp_pass|bitlocker_vault_secret|password\s*=|secret\s*=|token\s*=)/i;

export function isOfflineActionType(value: unknown): value is OfflineActionType {
  return typeof value === "string" && (offlineActionTypes as readonly string[]).includes(value);
}

export function isSupportedOfflineActionType(value: unknown): value is "TEST_OFFLINE_NOTE" {
  return value === "TEST_OFFLINE_NOTE";
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

export function validateOfflineActionForQueue(input: { actionType: unknown; payload: unknown }) {
  if (!isOfflineActionType(input.actionType)) return { ok: false as const, message: "Unsupported offline action type." };
  const sensitive = findSensitivePayloadIssue(input.payload);
  if (sensitive) return { ok: false as const, message: sensitive };
  if (input.actionType === "TEST_OFFLINE_NOTE") {
    const note = normalizeTestOfflineNotePayload(input.payload);
    if (!note.text) return { ok: false as const, message: "Test note text is required." };
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
  const note = normalizeTestOfflineNotePayload(input.payload);
  if (!note.text) return { ok: false as const, message: "Test note text is required." };
  return { ok: true as const };
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
