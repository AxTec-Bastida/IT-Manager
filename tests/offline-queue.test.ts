import { afterEach, describe, expect, it, vi } from "vitest";
import { findSensitivePayloadIssue, summarizeOfflinePayload, validateOfflineActionForQueue, validateOfflineSyncAction } from "@/lib/offline-actions";
import { cancelOfflineAction, clearSyncedOfflineActions, enqueueOfflineAction, getOfflineQueueSnapshot, retryOfflineAction, syncOfflineQueue } from "@/lib/offline-queue";
import { processOfflineSyncBatch } from "@/lib/offline-sync";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const actor = { id: "user-1", name: "QA User", email: "qa@example.local", username: "qa", role: "IT_STAFF" as const, isActive: true };

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("offline queue helpers", () => {
  it("queues safe test notes and transitions through cancel/retry/clear", () => {
    const storage = new MemoryStorage();
    const action = enqueueOfflineAction({ actionType: "TEST_OFFLINE_NOTE", payload: { text: "Safe QA note", route: "/offline" }, userId: "user-1", appVersion: "0.1.0" }, storage);

    expect(action.status).toBe("PENDING");
    expect(action.schemaVersion).toBe(1);
    expect(getOfflineQueueSnapshot(storage)).toMatchObject({ pendingCount: 1, failedCount: 0, syncedCount: 0 });

    cancelOfflineAction(action.clientActionId, storage);
    expect(getOfflineQueueSnapshot(storage).items[0].status).toBe("CANCELLED");

    retryOfflineAction(action.clientActionId, storage);
    expect(getOfflineQueueSnapshot(storage).items[0].status).toBe("CANCELLED");

    const failed = { ...getOfflineQueueSnapshot(storage).items[0], status: "FAILED" as const, lastError: "Network down" };
    storage.setItem("warehouse-it-offline-queue-v1", JSON.stringify([failed]));
    retryOfflineAction(action.clientActionId, storage);
    expect(getOfflineQueueSnapshot(storage).items[0]).toMatchObject({ status: "PENDING", lastError: null });

    storage.setItem("warehouse-it-offline-queue-v1", JSON.stringify([{ ...failed, status: "SYNCED" }]));
    clearSyncedOfflineActions(storage);
    expect(getOfflineQueueSnapshot(storage).items).toEqual([]);
  });

  it("rejects BitLocker-key-like or secret-looking payloads before local storage", () => {
    expect(validateOfflineActionForQueue({ actionType: "TEST_OFFLINE_NOTE", payload: { text: "111111-222222-333333-444444-555555-666666-777777-888888" } })).toMatchObject({ ok: false });
    expect(validateOfflineActionForQueue({ actionType: "TEST_OFFLINE_NOTE", payload: { password: "do-not-store" } })).toMatchObject({ ok: false });
    expect(findSensitivePayloadIssue({ note: "safe text" })).toBeNull();
    expect(summarizeOfflinePayload({ recoveryKey: "111111-222222-333333-444444-555555-666666-777777-888888" })).toBe("[rejected sensitive payload]");
  });

  it("marks local actions from server sync results", async () => {
    const storage = new MemoryStorage();
    const action = enqueueOfflineAction({ actionType: "TEST_OFFLINE_NOTE", payload: { text: "Sync me" } }, storage);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [{ clientActionId: action.clientActionId, status: "SYNCED", message: "Done", serverId: "sync-1" }] }), { status: 200 }));

    const result = await syncOfflineQueue(fetcher, storage);

    expect(result.synced).toBe(1);
    expect(fetcher).toHaveBeenCalledWith("/api/offline/sync", expect.objectContaining({ method: "POST" }));
    expect(getOfflineQueueSnapshot(storage).items[0]).toMatchObject({ status: "SYNCED", serverResult: { serverId: "sync-1" } });
  });
});

describe("offline sync server processor", () => {
  it("syncs TEST_OFFLINE_NOTE and stores only sanitized summaries", async () => {
    const records: Array<Record<string, unknown>> = [];
    const activityLogs: Array<Record<string, unknown>> = [];
    const fakePrisma = createFakePrisma(records, activityLogs);

    const result = await processOfflineSyncBatch([{ clientActionId: "action-1", actionType: "TEST_OFFLINE_NOTE", payload: { text: "Walked the queue", route: "/offline" } }], actor, fakePrisma as never);

    expect(result.summary).toMatchObject({ total: 1, synced: 1, failed: 0, conflict: 0 });
    expect(records[0]).toMatchObject({ clientActionId: "action-1", status: "SYNCED", actionType: "TEST_OFFLINE_NOTE", actorUserId: "user-1" });
    expect(records[0].payloadSummary).toContain("Walked the queue");
    expect(activityLogs[0]).toMatchObject({ action: "offline.test_note.synced", entity: "offline_sync_record" });
  });

  it("handles partial failures without crashing the batch", async () => {
    const records: Array<Record<string, unknown>> = [];
    const activityLogs: Array<Record<string, unknown>> = [];
    const fakePrisma = createFakePrisma(records, activityLogs);

    const result = await processOfflineSyncBatch(
      [
        { clientActionId: "action-ok", actionType: "TEST_OFFLINE_NOTE", payload: { text: "Safe" } },
        { clientActionId: "action-future", actionType: "MOVE_ASSET", payload: { assetId: "asset-1" } },
        { clientActionId: "action-secret", actionType: "TEST_OFFLINE_NOTE", payload: { text: "111111-222222-333333-444444-555555-666666-777777-888888" } },
      ],
      actor,
      fakePrisma as never,
    );

    expect(result.summary).toMatchObject({ total: 3, synced: 1, failed: 1, conflict: 1 });
    expect(result.results.map((item) => item.status)).toEqual(["SYNCED", "CONFLICT", "FAILED"]);
    expect(JSON.stringify(records)).not.toContain("111111-222222-333333-444444-555555-666666-777777-888888");
  });

  it("treats already synced client action IDs as idempotent", async () => {
    const records: Array<Record<string, unknown>> = [{ id: "sync-1", clientActionId: "action-1", status: "SYNCED", actionType: "TEST_OFFLINE_NOTE" }];
    const fakePrisma = createFakePrisma(records, []);

    const result = await processOfflineSyncBatch([{ clientActionId: "action-1", actionType: "TEST_OFFLINE_NOTE", payload: { text: "Again" } }], actor, fakePrisma as never);

    expect(result.results[0]).toMatchObject({ status: "SYNCED", message: "Action was already synced.", serverId: "sync-1" });
    expect(records).toHaveLength(1);
  });

  it("validates unsupported and unsafe sync actions explicitly", () => {
    expect(validateOfflineSyncAction({ clientActionId: "action-1", actionType: "CREATE_TASK", payload: { title: "Future" } })).toMatchObject({ ok: false, message: "This action type is not supported offline yet." });
    expect(validateOfflineSyncAction({ clientActionId: "action-2", actionType: "TEST_OFFLINE_NOTE", payload: { bitlockerKey: "secret" } })).toMatchObject({ ok: false });
  });
});

describe("offline sync API route", () => {
  it("requires authentication", async () => {
    vi.doMock("@/lib/auth", async () => {
      const errors = await import("@/lib/auth-errors");
      return {
        requireAuth: vi.fn(async () => {
          throw new errors.AuthRequiredError();
        }),
        makeActivityActor: vi.fn(),
      };
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));

    const route = await import("../app/api/offline/sync/route");
    const response = await route.POST(new Request("http://test/api/offline/sync", { method: "POST", body: JSON.stringify({ actions: [] }) }) as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Authentication required." });
  });
});

function createFakePrisma(records: Array<Record<string, unknown>>, activityLogs: Array<Record<string, unknown>>) {
  const tx = {
    offlineSyncRecord: {
      upsert: vi.fn(async ({ where, create, update }: { where: { clientActionId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = records.find((record) => record.clientActionId === where.clientActionId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const record = { id: `sync-${records.length + 1}`, ...create };
        records.push(record);
        return record;
      }),
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        activityLogs.push(data);
        return data;
      }),
    },
  };

  return {
    offlineSyncRecord: {
      findUnique: vi.fn(async ({ where }: { where: { clientActionId: string } }) => records.find((record) => record.clientActionId === where.clientActionId) ?? null),
      upsert: tx.offlineSyncRecord.upsert,
    },
    activityLog: tx.activityLog,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
}
