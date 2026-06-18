import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelOfflineConflict, inferOfflineConflictCode, markOfflineConflictReviewed, parseSafeSummary, retryOfflineConflict, sanitizeOfflineConflictRecord } from "@/lib/offline-conflicts";

const admin = { id: "admin-1", name: "Admin User", email: "admin@example.local", username: "admin", role: "ADMIN" as const, isActive: true };
const itStaff = { ...admin, id: "it-1", role: "IT_STAFF" as const };
const viewer = { ...admin, id: "viewer-1", role: "VIEWER" as const };

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("offline conflict review helpers", () => {
  it("maps conflict messages to user-safe codes", () => {
    expect(inferOfflineConflictCode("Asset could not be found during sync.", "MOVE_ASSET")).toBe("ASSET_NOT_FOUND");
    expect(inferOfflineConflictCode("You no longer have permission to move inventory assets.", "MOVE_ASSET")).toBe("PERMISSION_DENIED");
    expect(inferOfflineConflictCode("Target location anchor no longer exists or is inactive.", "MOVE_ASSET")).toBe("TARGET_LOCATION_NOT_FOUND");
    expect(inferOfflineConflictCode("This action type is not supported offline yet.", "CREATE_TASK")).toBe("UNSUPPORTED_ACTION");
  });

  it("does not parse secret-looking summaries for UI/API exposure", () => {
    expect(parseSafeSummary(JSON.stringify({ assetTag: "QA-1", targetLocationLabel: "Bench" }))).toMatchObject({ assetTag: "QA-1" });
    expect(parseSafeSummary("[rejected sensitive payload]")).toBeNull();
    expect(parseSafeSummary(JSON.stringify({ bitlockerKey: "111111-222222-333333-444444-555555-666666-777777-888888" }))).toBeNull();
  });

  it("sanitizes review records with conflict labels and no raw secret payload", () => {
    const record = sanitizeOfflineConflictRecord({
      id: "sync-1",
      clientActionId: "action-1",
      actionType: "MOVE_ASSET",
      status: "CONFLICT",
      resolutionStatus: "OPEN",
      actorUserId: "it-1",
      actorName: "IT User",
      reviewedAt: null,
      reviewedByUserId: null,
      reviewedByUser: null,
      reviewNote: null,
      conflictCode: "ASSET_NOT_FOUND",
      entityType: "device",
      entityId: null,
      entityLabel: "QA-MISSING",
      payloadSummary: JSON.stringify({ assetTag: "QA-MISSING", targetLocationLabel: "Bench" }),
      resultSummary: JSON.stringify({ message: "Asset missing at sync time." }),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      processedAt: new Date("2026-01-01T00:01:00.000Z"),
    } as never);

    expect(record.conflictTitle).toBe("Asset not found");
    expect(record.payload).toMatchObject({ assetTag: "QA-MISSING" });
    expect(JSON.stringify(record)).not.toContain("BitLocker");
  });

  it("allows IT/Admin to mark reviewed and blocks viewer review", async () => {
    const { client, record, activityLogs } = fakeReviewClient();

    await expect(markOfflineConflictReviewed(record.id, viewer, "viewer note", client as never)).rejects.toThrow("permission");
    const reviewed = await markOfflineConflictReviewed(record.id, itStaff, "Checked against asset detail", client as never);

    expect(reviewed).toMatchObject({ id: record.id, resolutionStatus: "REVIEWED", reviewNote: "Checked against asset detail", reviewedByUserId: "it-1" });
    expect(activityLogs[0]).toMatchObject({ action: "offline.conflict.reviewed", entity: "offline_sync_record", entityId: record.id });
  });

  it("cancels a conflict without applying a move", async () => {
    const { client, record, activityLogs } = fakeReviewClient();
    const cancelled = await cancelOfflineConflict(record.id, admin, "Stale queued move", client as never);

    expect(cancelled).toMatchObject({ id: record.id, status: "CANCELLED", resolutionStatus: "CANCELLED", reviewNote: "Stale queued move" });
    expect(activityLogs[0]).toMatchObject({ action: "offline.conflict.cancelled", entity: "offline_sync_record", entityId: record.id });
    expect(client.device).toBeUndefined();
  });

  it("blocks server-only retry for photo upload conflicts that require a browser-local blob", async () => {
    const { client, record } = fakeReviewClient({
      actionType: "UPLOAD_ASSET_PHOTO",
      payloadSummary: JSON.stringify({ deviceId: "dev-1", assetTag: "QA-PHOTO-001", fileName: "overview.webp", mimeType: "image/webp", sizeBytes: 10_000 }),
      resultSummary: JSON.stringify({ message: "Local photo file is no longer available. Retake the photo." }),
    });

    await expect(retryOfflineConflict(record.id as string, admin, client as never)).rejects.toThrow("original browser/device");
  });
});

describe("offline conflict API routes", () => {
  it("requires authentication for conflict list", async () => {
    vi.doMock("@/lib/auth", async () => {
      const errors = await import("@/lib/auth-errors");
      return {
        requireAuth: vi.fn(async () => {
          throw new errors.AuthRequiredError();
        }),
      };
    });
    vi.doMock("@/lib/offline-conflicts", () => ({
      canReadOfflineConflicts: vi.fn(),
      getOfflineConflictRecords: vi.fn(),
      getOfflineConflictHealth: vi.fn(),
    }));

    const route = await import("../app/api/offline/conflicts/route");
    const response = await route.GET(new Request("http://test/api/offline/conflicts") as never);

    expect(response.status).toBe(401);
  });

  it("blocks viewer mutation through review API", async () => {
    vi.doMock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => viewer) }));
    vi.doMock("@/lib/offline-conflicts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/offline-conflicts")>("@/lib/offline-conflicts");
      return {
        ...actual,
        markOfflineConflictReviewed: vi.fn(async () => {
          const { ClientInputError } = await import("@/lib/api");
          throw new ClientInputError("You do not have permission to review offline conflicts.", 403);
        }),
      };
    });

    const route = await import("../app/api/offline/conflicts/[id]/review/route");
    const response = await route.POST(new Request("http://test/api/offline/conflicts/sync-1/review", { method: "POST", body: JSON.stringify({ reviewNote: "nope" }) }) as never, { params: Promise.resolve({ id: "sync-1" }) });

    expect(response.status).toBe(403);
  });
});

function fakeReviewClient(overrides: Record<string, unknown> = {}) {
  const activityLogs: Array<Record<string, unknown>> = [];
  const record: Record<string, unknown> = {
    id: "sync-1",
    clientActionId: "move-conflict",
    actionType: "MOVE_ASSET",
    status: "CONFLICT",
    resolutionStatus: "OPEN",
    actorUserId: "it-1",
    actorName: "IT User",
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedByUser: null,
    reviewNote: null,
    conflictCode: "STALE_LOCATION",
    entityType: "device",
    entityId: "dev-1",
    entityLabel: "QA-OFFLINE-MOVE-001",
    payloadSummary: JSON.stringify({ assetTag: "QA-OFFLINE-MOVE-001", targetLocationLabel: "Bench" }),
    resultSummary: JSON.stringify({ message: "Asset map location changed before sync." }),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    processedAt: new Date("2026-01-01T00:01:00.000Z"),
    ...overrides,
  };
  const tx = {
    offlineSyncRecord: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(record, data, { reviewedByUser: data.reviewedByUserId ? { id: data.reviewedByUserId, name: data.reviewedByUserId === "it-1" ? "IT User" : "Admin User", role: data.reviewedByUserId === "it-1" ? "IT_STAFF" : "ADMIN" } : null });
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
  const client = {
    offlineSyncRecord: {
      findUnique: vi.fn(async () => record),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { client, record, activityLogs };
}
