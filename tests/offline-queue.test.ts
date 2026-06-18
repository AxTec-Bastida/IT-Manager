import { afterEach, describe, expect, it, vi } from "vitest";
import { findSensitivePayloadIssue, summarizeOfflinePayload, summarizeQueuedOfflineAction, validateOfflineActionForQueue, validateOfflineSyncAction } from "@/lib/offline-actions";
import { cancelOfflineAction, clearSyncedOfflineActions, enqueueOfflineAction, getOfflineQueueSnapshot, retryOfflineAction, syncOfflineQueue } from "@/lib/offline-queue";
import { processOfflineSyncBatch } from "@/lib/offline-sync";
import { processOfflinePhotoSyncAction } from "@/lib/offline-photo-sync";
import { inferOfflineConflictCode, reconstructOfflineAction } from "@/lib/offline-conflicts";

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

  it("validates and summarizes offline asset move payloads", () => {
    expect(validateOfflineActionForQueue({ actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001", targetLocationLabel: "QA Bench" } })).toMatchObject({ ok: true });
    expect(validateOfflineActionForQueue({ actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001" } })).toMatchObject({ ok: false });
    expect(validateOfflineSyncAction({ clientActionId: "move-1", actionType: "MOVE_ASSET", payload: { deviceId: "dev-1", targetArea: "QA", targetStation: "Bench" } })).toMatchObject({ ok: true });
    expect(summarizeQueuedOfflineAction({ actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001", targetArea: "QA", targetStation: "Bench", notes: "Safe test move" } })).toMatchObject({
      title: "Move QA-OFFLINE-MOVE-001",
      detail: "QA / Bench",
      note: "Safe test move",
    });
  });

  it("validates and summarizes offline asset photo payloads without storing file bytes", () => {
    const payload = {
      deviceId: "dev-1",
      assetTag: "QA-PHOTO-001",
      fileName: "overview.webp",
      mimeType: "image/webp",
      sizeBytes: 150_000,
      photoType: "OVERVIEW",
      caption: "Front label",
    };

    expect(validateOfflineActionForQueue({ actionType: "UPLOAD_ASSET_PHOTO", payload })).toMatchObject({ ok: true });
    expect(validateOfflineSyncAction({ clientActionId: "photo-1", actionType: "UPLOAD_ASSET_PHOTO", payload })).toMatchObject({ ok: true });
    expect(validateOfflineActionForQueue({ actionType: "UPLOAD_ASSET_PHOTO", payload: { ...payload, mimeType: "application/pdf" } })).toMatchObject({ ok: false });
    expect(validateOfflineActionForQueue({ actionType: "UPLOAD_ASSET_PHOTO", payload: { ...payload, sizeBytes: 99_000_000 } })).toMatchObject({ ok: false });
    expect(summarizeQueuedOfflineAction({ actionType: "UPLOAD_ASSET_PHOTO", payload })).toMatchObject({
      title: "Photo for QA-PHOTO-001",
      detail: "overview.webp - 147 KB",
      note: "OVERVIEW - Front label",
    });
    expect(JSON.stringify(enqueueOfflineAction({ actionType: "UPLOAD_ASSET_PHOTO", payload }, new MemoryStorage()))).not.toContain("data:image");
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

  it("syncs asset photo actions through the multipart photo endpoint", async () => {
    const storage = new MemoryStorage();
    const action = enqueueOfflineAction(
      {
        clientActionId: "photo-action-1",
        actionType: "UPLOAD_ASSET_PHOTO",
        payload: { deviceId: "dev-1", fileName: "overview.webp", mimeType: "image/webp", sizeBytes: 150_000, photoType: "OVERVIEW" },
      },
      storage,
    );
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/offline/sync/photo");
      expect(init?.body).toBeInstanceOf(FormData);
      return new Response(JSON.stringify({ clientActionId: action.clientActionId, status: "CONFLICT", message: "Local photo file is no longer available." }), { status: 409 });
    });

    const result = await syncOfflineQueue(fetcher, storage);

    expect(result.conflict).toBe(1);
    expect(getOfflineQueueSnapshot(storage).items[0]).toMatchObject({ status: "CONFLICT", lastError: "Local photo file is no longer available." });
  });

  it("clears synced photo metadata and the matching local photo blob", async () => {
    vi.resetModules();
    const deleteOfflinePhotoBlobs = vi.fn(async () => undefined);
    vi.doMock("@/lib/offline-photo-blobs", () => ({
      deleteOfflinePhotoBlob: vi.fn(async () => undefined),
      deleteOfflinePhotoBlobs,
      getOfflinePhotoBlob: vi.fn(async () => null),
    }));
    const { clearSyncedOfflineActionsAndBlobs, getOfflineQueueSnapshot } = await import("@/lib/offline-queue");
    const storage = new MemoryStorage();
    const syncedPhoto = {
      clientActionId: "photo-synced",
      actionType: "UPLOAD_ASSET_PHOTO",
      payload: { deviceId: "dev-1", fileName: "overview.webp", mimeType: "image/webp", sizeBytes: 10_000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "SYNCED",
      attempts: 1,
      lastError: null,
      serverResult: null,
      userId: "user-1",
      appVersion: "0.1.0",
      schemaVersion: 1,
    };
    const pendingMove = { ...syncedPhoto, clientActionId: "move-pending", actionType: "MOVE_ASSET", payload: { assetTag: "QA-1", targetLocationLabel: "Bench" }, status: "PENDING" };
    storage.setItem("warehouse-it-offline-queue-v1", JSON.stringify([syncedPhoto, pendingMove]));

    await clearSyncedOfflineActionsAndBlobs(storage);

    expect(deleteOfflinePhotoBlobs).toHaveBeenCalledWith(["photo-synced"]);
    expect(getOfflineQueueSnapshot(storage).items).toHaveLength(1);
    expect(getOfflineQueueSnapshot(storage).items[0]).toMatchObject({ clientActionId: "move-pending", status: "PENDING" });
  });

  it("blocks retrying a failed photo action when the local blob is gone", async () => {
    vi.resetModules();
    vi.doMock("@/lib/offline-photo-blobs", () => ({
      deleteOfflinePhotoBlob: vi.fn(async () => undefined),
      deleteOfflinePhotoBlobs: vi.fn(async () => undefined),
      getOfflinePhotoBlob: vi.fn(async () => null),
    }));
    const { getOfflineQueueSnapshot, retryOfflineActionIfLocalBlobExists } = await import("@/lib/offline-queue");
    const storage = new MemoryStorage();
    storage.setItem(
      "warehouse-it-offline-queue-v1",
      JSON.stringify([
        {
          clientActionId: "photo-failed",
          actionType: "UPLOAD_ASSET_PHOTO",
          payload: { deviceId: "dev-1", fileName: "overview.webp", mimeType: "image/webp", sizeBytes: 10_000 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "FAILED",
          attempts: 1,
          lastError: "Network failed",
          serverResult: null,
          userId: "user-1",
          appVersion: "0.1.0",
          schemaVersion: 1,
        },
      ]),
    );

    const result = await retryOfflineActionIfLocalBlobExists("photo-failed", storage);

    expect(result).toMatchObject({ ok: false, message: "Local photo file is no longer available. Retake the photo before retrying." });
    expect(getOfflineQueueSnapshot(storage).items[0]).toMatchObject({ status: "FAILED", lastError: "Network failed" });
  });

  it("allows retrying a failed photo action when the browser still has the local blob", async () => {
    vi.resetModules();
    vi.doMock("@/lib/offline-photo-blobs", () => ({
      deleteOfflinePhotoBlob: vi.fn(async () => undefined),
      deleteOfflinePhotoBlobs: vi.fn(async () => undefined),
      getOfflinePhotoBlob: vi.fn(async () => ({
        blob: new Blob(["photo"], { type: "image/webp" }),
        fileName: "overview.webp",
        mimeType: "image/webp",
        sizeBytes: 5,
        savedAt: new Date().toISOString(),
      })),
    }));
    const { getOfflineQueueSnapshot, retryOfflineActionIfLocalBlobExists } = await import("@/lib/offline-queue");
    const storage = new MemoryStorage();
    storage.setItem(
      "warehouse-it-offline-queue-v1",
      JSON.stringify([
        {
          clientActionId: "photo-failed",
          actionType: "UPLOAD_ASSET_PHOTO",
          payload: { deviceId: "dev-1", fileName: "overview.webp", mimeType: "image/webp", sizeBytes: 10_000 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "FAILED",
          attempts: 1,
          lastError: "Network failed",
          serverResult: null,
          userId: "user-1",
          appVersion: "0.1.0",
          schemaVersion: 1,
        },
      ]),
    );

    const result = await retryOfflineActionIfLocalBlobExists("photo-failed", storage);

    expect(result).toMatchObject({ ok: true });
    expect(getOfflineQueueSnapshot(storage).items[0]).toMatchObject({ status: "PENDING", lastError: null });
  });
});

describe("offline sync server processor", () => {
  it("syncs TEST_OFFLINE_NOTE and stores only sanitized summaries", async () => {
    const records: Array<Record<string, unknown>> = [];
    const activityLogs: Array<Record<string, unknown>> = [];
    const fakePrisma = createFakePrisma(records, activityLogs);

    const result = await processOfflineSyncBatch([{ clientActionId: "action-1", actionType: "TEST_OFFLINE_NOTE", payload: { text: "Walked the queue", route: "/offline" } }], actor, fakePrisma as never);

    expect(result.summary).toMatchObject({ total: 1, synced: 1, failed: 0, conflict: 0 });
    expect(records[0]).toMatchObject({ clientActionId: "action-1", status: "SYNCED", resolutionStatus: "RESOLVED", actionType: "TEST_OFFLINE_NOTE", actorUserId: "user-1" });
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

  it("syncs MOVE_ASSET and creates an audit trail", async () => {
    const records: Array<Record<string, unknown>> = [];
    const activityLogs: Array<Record<string, unknown>> = [];
    const device = moveDevice();
    const fakePrisma = createFakeMovePrisma({ records, activityLogs, device });

    const result = await processOfflineSyncBatch(
      [
        {
          clientActionId: "move-ok",
          actionType: "MOVE_ASSET",
          payload: {
            assetTag: "QA-OFFLINE-MOVE-001",
            targetArea: "QA",
            targetDepartment: "IT",
            targetStation: "Bench 2",
            targetLocationLabel: "QA Bench 2",
            notes: "Moved during offline QA",
            lastKnownDeviceStatus: "ACTIVE",
            lastKnownMapAnchorId: null,
            lastKnownAssignmentId: null,
          },
        },
      ],
      actor,
      fakePrisma as never,
    );

    expect(result.summary).toMatchObject({ total: 1, synced: 1, failed: 0, conflict: 0 });
    expect(device).toMatchObject({ areaDepartment: "QA / IT", location: "Bench 2" });
    expect(records[0]).toMatchObject({ clientActionId: "move-ok", status: "SYNCED", resolutionStatus: "RESOLVED", actionType: "MOVE_ASSET", entityType: "device", entityId: "dev-1", entityLabel: "QA-OFFLINE-MOVE-001" });
    expect(activityLogs[0]).toMatchObject({ action: "device.offline_move.synced", entity: "device", entityId: "dev-1" });
  });

  it("returns move conflicts without applying unsafe changes", async () => {
    const missing = await processOfflineSyncBatch([{ clientActionId: "move-missing", actionType: "MOVE_ASSET", payload: { assetTag: "MISSING", targetLocationLabel: "QA Bench" } }], actor, createFakeMovePrisma({ device: null }) as never);
    expect(missing.results[0]).toMatchObject({ status: "CONFLICT", message: "Asset could not be found during sync." });

    const retiredDevice = moveDevice({ status: "RETIRED" });
    const retired = await processOfflineSyncBatch([{ clientActionId: "move-retired", actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001", targetLocationLabel: "QA Bench" } }], actor, createFakeMovePrisma({ device: retiredDevice }) as never);
    expect(retired.results[0]).toMatchObject({ status: "CONFLICT" });
    expect(retiredDevice.location).toBe("Old Location");

    const invalidAnchor = await processOfflineSyncBatch([{ clientActionId: "move-anchor", actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001", targetMapAnchorId: "missing-anchor" } }], actor, createFakeMovePrisma({ device: moveDevice(), mapAnchor: null }) as never);
    expect(invalidAnchor.results[0]).toMatchObject({ status: "CONFLICT", message: "Target location anchor no longer exists or is inactive." });
  });

  it("denies MOVE_ASSET at sync time when permission is missing", async () => {
    const viewer = { ...actor, role: "VIEWER" as const };
    const device = moveDevice();
    const result = await processOfflineSyncBatch([{ clientActionId: "move-denied", actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001", targetLocationLabel: "QA Bench" } }], viewer, createFakeMovePrisma({ device }) as never);

    expect(result.results[0]).toMatchObject({ status: "CONFLICT", message: "You no longer have permission to move inventory assets." });
    expect(device.location).toBe("Old Location");
  });

  it("returns conflict when last-known move state is stale", async () => {
    const result = await processOfflineSyncBatch(
      [{ clientActionId: "move-stale", actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001", targetLocationLabel: "QA Bench", lastKnownMapAnchorId: "old-anchor" } }],
      actor,
      createFakeMovePrisma({ device: moveDevice({ currentMapAnchorId: "new-anchor" }) }) as never,
    );

    expect(result.results[0]).toMatchObject({ status: "CONFLICT", message: "Asset map location changed before sync. Review the move before applying it." });
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

  it("records an offline photo conflict when the local browser blob is missing", async () => {
    const records: Array<Record<string, unknown>> = [];
    const activityLogs: Array<Record<string, unknown>> = [];
    const result = await processOfflinePhotoSyncAction(
      {
        clientActionId: "photo-missing-blob",
        actionType: "UPLOAD_ASSET_PHOTO",
        payload: { deviceId: "dev-1", assetTag: "QA-PHOTO-001", fileName: "overview.webp", mimeType: "image/webp", sizeBytes: 150_000, photoType: "OVERVIEW" },
        file: null,
      },
      actor,
      createFakePhotoPrisma({ records, activityLogs, device: moveDevice({ assetTag: "QA-PHOTO-001" }) }) as never,
    );

    expect(result).toMatchObject({ status: "CONFLICT", relatedDeviceId: "dev-1", relatedAssetTag: "QA-PHOTO-001", message: "Local photo file is no longer available. Retake the photo." });
    expect(records[0]).toMatchObject({ actionType: "UPLOAD_ASSET_PHOTO", status: "CONFLICT", conflictCode: "INVALID_PAYLOAD", entityType: "device" });
    expect(activityLogs[0]).toMatchObject({ action: "offline.photo_upload.conflict_created", entity: "offline_sync_record" });
  });

  it("keeps photo uploads on the multipart endpoint when JSON sync receives photo metadata", async () => {
    const records: Array<Record<string, unknown>> = [];
    const activityLogs: Array<Record<string, unknown>> = [];
    const result = await processOfflineSyncBatch(
      [{ clientActionId: "photo-json", actionType: "UPLOAD_ASSET_PHOTO", payload: { deviceId: "dev-1", fileName: "overview.webp", mimeType: "image/webp", sizeBytes: 150_000 } }],
      actor,
      createFakePrisma(records, activityLogs) as never,
    );

    expect(result.results[0]).toMatchObject({ status: "CONFLICT", message: expect.stringContaining("original browser/device") });
    expect(records[0]).toMatchObject({ actionType: "UPLOAD_ASSET_PHOTO", status: "CONFLICT", conflictCode: "INVALID_PAYLOAD" });
  });

  it("maps user-safe offline conflict codes and reconstructs retry actions from sanitized summaries", () => {
    expect(inferOfflineConflictCode("Asset could not be found during sync.", "MOVE_ASSET")).toBe("ASSET_NOT_FOUND");
    expect(inferOfflineConflictCode("This action type is not supported offline yet.", "CREATE_TASK")).toBe("UNSUPPORTED_ACTION");
    expect(inferOfflineConflictCode("Asset assignment changed before sync.", "MOVE_ASSET")).toBe("STALE_ASSIGNMENT");

    const retryAction = reconstructOfflineAction({
      clientActionId: "move-retry",
      actionType: "MOVE_ASSET",
      payloadSummary: JSON.stringify({ assetTag: "QA-OFFLINE-MOVE-001", targetLocationLabel: "QA Bench" }),
    } as never);
    expect(retryAction).toMatchObject({ clientActionId: "move-retry", actionType: "MOVE_ASSET", payload: { assetTag: "QA-OFFLINE-MOVE-001" } });
    expect(() => reconstructOfflineAction({ clientActionId: "secret", actionType: "TEST_OFFLINE_NOTE", payloadSummary: "[rejected sensitive payload]" } as never)).toThrow("safe payload summary is unavailable");
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

function moveDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev-1",
    name: "QA Offline Move Asset",
    assetTag: "QA-OFFLINE-MOVE-001",
    serialNumber: "QA-SERIAL",
    category: "LAPTOP",
    status: "ACTIVE",
    condition: "GOOD",
    location: "Old Location",
    areaDepartment: "Old Area",
    ipAddress: null,
    macAddress: null,
    vlan: null,
    ipRangeId: null,
    usesStaticIp: false,
    isFixedAsset: false,
    currentMapAnchorId: null,
    assignmentItems: [],
    assetLoanItems: [],
    rmaItems: [],
    ...overrides,
  };
}

function createFakeMovePrisma({
  records = [],
  activityLogs = [],
  device = moveDevice(),
  mapAnchor = { id: "anchor-1", apName: "QA Anchor", locationLabel: "QA Bench", area: "QA", department: "IT", station: "Bench 2", displayPath: "QA / IT / Bench 2" },
}: {
  records?: Array<Record<string, unknown>>;
  activityLogs?: Array<Record<string, unknown>>;
  device?: Record<string, unknown> | null;
  mapAnchor?: Record<string, unknown> | null;
}) {
  const offlineSyncRecord = {
    findUnique: vi.fn(async ({ where }: { where: { clientActionId: string } }) => records.find((record) => record.clientActionId === where.clientActionId) ?? null),
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
  };
  const tx = {
    offlineSyncRecord,
    device: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (!device) throw new Error("Missing fake device");
        Object.assign(device, data);
        return device;
      }),
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `activity-${activityLogs.length + 1}`, ...data };
        activityLogs.push(created);
        return created;
      }),
    },
  };

  return {
    offlineSyncRecord,
    activityLog: tx.activityLog,
    device: {
      findFirst: vi.fn(async () => device),
      findMany: vi.fn(async () => (device ? [device] : [])),
    },
    accessPointMapLocation: {
      findFirst: vi.fn(async () => mapAnchor),
    },
    ipRange: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
}

function createFakePhotoPrisma({
  records = [],
  activityLogs = [],
  device = moveDevice(),
}: {
  records?: Array<Record<string, unknown>>;
  activityLogs?: Array<Record<string, unknown>>;
  device?: Record<string, unknown> | null;
}) {
  const offlineSyncRecord = {
    findUnique: vi.fn(async ({ where }: { where: { clientActionId: string } }) => records.find((record) => record.clientActionId === where.clientActionId) ?? null),
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
    update: vi.fn(async ({ where, data }: { where: { clientActionId: string }; data: Record<string, unknown> }) => {
      const existing = records.find((record) => record.clientActionId === where.clientActionId);
      if (!existing) throw new Error("Missing fake sync record");
      Object.assign(existing, data);
      return existing;
    }),
  };

  return {
    offlineSyncRecord,
    device: {
      findFirst: vi.fn(async () => device),
      findUnique: vi.fn(async () => device),
    },
    activityLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `activity-${activityLogs.length + 1}`, ...data };
        activityLogs.push(created);
        return created;
      }),
    },
  };
}
