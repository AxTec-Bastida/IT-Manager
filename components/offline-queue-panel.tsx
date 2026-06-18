"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, HardDrive, RotateCcw, Trash2, XCircle } from "lucide-react";
import { summarizeQueuedOfflineAction } from "@/lib/offline-actions";
import { cancelOfflineActionAndBlob, clearSyncedOfflineActionsAndBlobs, enqueueOfflineAction, getOfflineQueueSnapshot, retryOfflineActionIfLocalBlobExists, syncOfflineQueue, type OfflineQueueSnapshot } from "@/lib/offline-queue";
import { getOfflinePhotoBlob, listOfflinePhotoBlobMetadata } from "@/lib/offline-photo-blobs";
import { OfflineStatusIndicator } from "@/components/offline-status-indicator";

type QueuedItem = OfflineQueueSnapshot["items"][number];
type StorageInfo = {
  queuedPhotoCount: number;
  queuedPhotoBytes: number;
  usageBytes: number | null;
  quotaBytes: number | null;
};

export function OfflineQueuePanel({ userId, appVersion }: { userId: string; appVersion: string }) {
  const [snapshot, setSnapshot] = useState<OfflineQueueSnapshot>(() => getOfflineQueueSnapshot());
  const [note, setNote] = useState("QA offline queue test note");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ queuedPhotoCount: 0, queuedPhotoBytes: 0, usageBytes: null, quotaBytes: null });

  function refresh() {
    setSnapshot(getOfflineQueueSnapshot());
  }

  async function readStorageInfo(): Promise<StorageInfo> {
    const [photos, estimate] = await Promise.all([
      listOfflinePhotoBlobMetadata().catch(() => []),
      typeof navigator !== "undefined" && navigator.storage?.estimate ? navigator.storage.estimate().catch(() => null) : Promise.resolve(null),
    ]);
    return {
      queuedPhotoCount: photos.length,
      queuedPhotoBytes: photos.reduce((sum, photo) => sum + photo.sizeBytes, 0),
      usageBytes: typeof estimate?.usage === "number" ? estimate.usage : null,
      quotaBytes: typeof estimate?.quota === "number" ? estimate.quota : null,
    };
  }

  async function refreshStorageInfo() {
    setStorageInfo(await readStorageInfo());
  }

  useEffect(() => {
    const timeout = window.setTimeout(refresh, 0);
    window.addEventListener("offline-queue-changed", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("offline-queue-changed", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void readStorageInfo().then((info) => {
      if (active) setStorageInfo(info);
    });
    return () => {
      active = false;
    };
  }, [snapshot.items]);

  const recentSynced = useMemo(() => snapshot.items.filter((item) => item.status === "SYNCED").slice(0, 5), [snapshot.items]);

  function createTestNote() {
    setError(null);
    setMessage(null);
    try {
      const action = enqueueOfflineAction({
        actionType: "TEST_OFFLINE_NOTE",
        payload: { text: note, route: window.location.pathname, timestamp: new Date().toISOString() },
        userId,
        appVersion,
      });
      setMessage(`Queued test note ${action.clientActionId}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue test note.");
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await syncOfflineQueue();
      setMessage(`Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.conflict} conflict.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync offline queue.");
      refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function clearSynced() {
    await clearSyncedOfflineActionsAndBlobs();
    setMessage("Synced actions cleared from this browser.");
    refresh();
    await refreshStorageInfo();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">Connection and queue status</p>
            <p className="text-sm text-slate-600">This queue supports test notes, serialized asset moves, and asset photo uploads. Stock, RMA, factura, admin, and BitLocker actions stay online-only.</p>
          </div>
          <OfflineStatusIndicator />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard label="Pending" value={snapshot.pendingCount + snapshot.syncingCount} />
          <SummaryCard label="Failed" value={snapshot.failedCount} />
          <SummaryCard label="Conflicts" value={snapshot.conflictCount} />
          <SummaryCard label="Synced" value={snapshot.syncedCount} />
          <SummaryCard label="Total local" value={snapshot.items.length} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={syncNow} disabled={syncing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">
            <RotateCcw size={17} />
            {syncing ? "Syncing..." : "Sync now"}
          </button>
          <button type="button" onClick={clearSynced} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">
            <Trash2 size={17} />
            Clear synced
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
          <Link href="/offline/move" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-sky-300 bg-sky-50 px-4 text-sm font-semibold text-sky-900 sm:w-auto">
            Queue offline asset move
          </Link>
          <Link href="/offline/conflicts" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-900 sm:w-auto">
            Review server conflicts
          </Link>
        </div>
        {message ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
      </section>

      <StorageSafetyCard info={storageInfo} />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Create test offline note</p>
            <p className="text-sm text-slate-600">Use this to prove local queue persistence and sync behavior without changing real inventory.</p>
          </div>
          <label className="text-sm font-semibold text-slate-700" htmlFor="offline-test-note">
            Test note
          </label>
          <textarea id="offline-test-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={createTestNote} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
            Create test offline note
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Local queued actions</h2>
          <p className="text-sm text-slate-600">Stored in this browser only. Server validation still happens during sync.</p>
        </div>
        {snapshot.items.length ? (
          <div className="space-y-3">
            {snapshot.items.map((item) => (
              <QueuedActionCard key={item.clientActionId} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No local queued actions in this browser.</div>
        )}
      </section>

      {recentSynced.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">Recent synced actions</h2>
          <div className="mt-3 space-y-2">
            {recentSynced.map((item) => (
              <p key={item.clientActionId} className="text-sm text-slate-600">
                {item.actionType} - {item.serverResult?.message || "Synced"}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function QueuedActionCard({ item }: { item: QueuedItem }) {
  const summary = summarizeQueuedOfflineAction(item);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoBlobAvailable, setPhotoBlobAvailable] = useState<boolean | null>(item.actionType === "UPLOAD_ASSET_PHOTO" ? null : true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const deviceHref = item.serverResult?.relatedDeviceId || summary.relatedDeviceId ? `/devices/${item.serverResult?.relatedDeviceId || summary.relatedDeviceId}` : null;

  useEffect(() => {
    if (item.actionType !== "UPLOAD_ASSET_PHOTO") return;
    let active = true;
    let objectUrl: string | null = null;
    getOfflinePhotoBlob(item.clientActionId)
      .then((record) => {
        if (!active) return;
        setPhotoBlobAvailable(Boolean(record?.blob));
        if (!record?.blob) return;
        objectUrl = URL.createObjectURL(record.blob);
        setPhotoPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPhotoBlobAvailable(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.actionType, item.clientActionId]);

  async function cancelAction() {
    if (item.actionType === "UPLOAD_ASSET_PHOTO") {
      const confirmed = window.confirm("Cancel queued photo? This removes the local unsynced photo from this browser/device.");
      if (!confirmed) return;
    }
    await cancelOfflineActionAndBlob(item.clientActionId);
  }

  async function retryAction() {
    const result = await retryOfflineActionIfLocalBlobExists(item.clientActionId);
    if (!result.ok) setActionMessage(result.message);
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {photoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreviewUrl} alt="Queued offline asset photo preview" className="mb-3 aspect-video w-full max-w-sm rounded-lg border border-slate-200 object-cover" />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{item.actionType}</span>
          </div>
          <p className="mt-2 break-all text-xs text-slate-500">{item.clientActionId}</p>
          <p className="mt-2 font-semibold text-slate-950">{summary.title}</p>
          <p className="mt-1 text-sm text-slate-700">{summary.detail}</p>
          {summary.note ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">{summary.note}</p> : null}
          <p className="mt-2 text-xs text-slate-500">Created {new Date(item.createdAt).toLocaleString()} - Attempts {item.attempts}</p>
          {item.lastError ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800">{item.lastError}</p> : null}
          {item.serverResult?.conflict ? <p className="mt-2 rounded-lg bg-orange-50 p-2 text-xs font-medium text-orange-800">{item.serverResult.conflict.reason}</p> : null}
          {item.actionType === "UPLOAD_ASSET_PHOTO" && photoBlobAvailable === false ? (
            <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-800">Local photo file is no longer available. Retake the photo before retrying.</p>
          ) : null}
          {actionMessage ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800">{actionMessage}</p> : null}
          {deviceHref ? (
            <Link href={deviceHref} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700">
              Open asset
            </Link>
          ) : null}
        </div>
        <div className="grid gap-2 sm:min-w-40">
          {item.status === "PENDING" ? (
            <button type="button" onClick={() => void cancelAction()} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700">
              Cancel
            </button>
          ) : null}
          {item.status === "FAILED" || item.status === "CONFLICT" ? (
            <button type="button" onClick={() => void retryAction()} disabled={item.actionType === "UPLOAD_ASSET_PHOTO" && photoBlobAvailable === false} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function StorageSafetyCard({ info }: { info: StorageInfo }) {
  const usage = info.usageBytes !== null && info.quotaBytes ? `${formatBytes(info.usageBytes)} used of ${formatBytes(info.quotaBytes)} available to this browser` : "Browser storage estimate unavailable";
  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
      <div className="flex items-start gap-3">
        <HardDrive className="mt-0.5 shrink-0" size={18} />
        <div className="min-w-0">
          <p className="font-semibold">Offline photo storage safety</p>
          <p className="mt-1">Unsynced photos are stored only on this browser/device. Clearing browser data removes them, so sync before switching devices and keep the browser open until sync when possible.</p>
          <p className="mt-2 text-xs font-medium">
            Queued photo blobs: {info.queuedPhotoCount} / {formatBytes(info.queuedPhotoBytes)}. {usage}.
          </p>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config =
    status === "SYNCED"
      ? { icon: CheckCircle2, className: "bg-emerald-50 text-emerald-800", label: "Synced" }
      : status === "FAILED"
        ? { icon: XCircle, className: "bg-red-50 text-red-800", label: "Failed" }
        : status === "CONFLICT"
          ? { icon: AlertTriangle, className: "bg-amber-50 text-amber-800", label: "Conflict" }
          : { icon: Clock, className: "bg-sky-50 text-sky-800", label: status === "SYNCING" ? "Syncing" : status === "CANCELLED" ? "Cancelled" : "Pending" };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${config.className}`}>
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
