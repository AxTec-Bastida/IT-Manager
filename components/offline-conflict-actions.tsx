"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

export function OfflineConflictActions({ recordId, mutable, actionType }: { recordId: string; mutable: boolean; actionType?: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(action: "review" | "cancel" | "retry") {
    if (!mutable) return;
    setBusy(action);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/offline/conflicts/${recordId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: action === "retry" ? undefined : JSON.stringify({ reviewNote: note }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; result?: { message?: string } };
      if (!response.ok) throw new Error(payload.error || "Could not update offline conflict.");
      setMessage(action === "retry" ? payload.result?.message || "Retry attempted." : action === "cancel" ? "Offline action cancelled." : "Offline conflict marked reviewed.");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update offline conflict.");
    } finally {
      setBusy(null);
    }
  }

  if (!mutable) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">You can read this conflict, but retry, cancel, and review actions require IT Staff or Admin access.</p>;
  }
  const photoUploadConflict = actionType === "UPLOAD_ASSET_PHOTO";

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`offline-conflict-note-${recordId}`}>
        Review note
      </label>
      <textarea
        id={`offline-conflict-note-${recordId}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        placeholder="Optional note for review or cancellation"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => post("review")} disabled={Boolean(busy)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">
          <CheckCircle2 size={16} />
          {busy === "review" ? "Saving..." : "Mark reviewed"}
        </button>
        {photoUploadConflict ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900 sm:col-span-1">Retry photo uploads from the Offline Queue on the same browser/device that still has the local photo.</p>
        ) : (
          <button type="button" onClick={() => post("retry")} disabled={Boolean(busy)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-60">
            <RotateCcw size={16} />
            {busy === "retry" ? "Retrying..." : "Retry sync"}
          </button>
        )}
        <button type="button" onClick={() => post("cancel")} disabled={Boolean(busy)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-800 disabled:opacity-60">
          <XCircle size={16} />
          {busy === "cancel" ? "Cancelling..." : "Cancel action"}
        </button>
      </div>
      {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
    </div>
  );
}
