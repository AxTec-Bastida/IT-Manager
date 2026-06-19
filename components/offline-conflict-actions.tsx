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
      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="min-h-10 cursor-pointer list-none text-sm font-semibold text-slate-800">Add optional review note</summary>
        <label className="mt-3 block text-sm font-semibold text-slate-700" htmlFor={`offline-conflict-note-${recordId}`}>
          Review note
        </label>
        <textarea
          id={`offline-conflict-note-${recordId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Optional note for review or cancellation"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </details>
      <div className="grid gap-2">
        <button type="button" onClick={() => post("review")} disabled={Boolean(busy)} className="tap-button-secondary rounded-lg">
          <CheckCircle2 size={16} />
          {busy === "review" ? "Saving..." : "Mark reviewed"}
        </button>
        {photoUploadConflict ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-900">Retry photo uploads from the Offline Queue on the same browser/device that still has the local photo.</p>
        ) : (
          <button type="button" onClick={() => post("retry")} disabled={Boolean(busy)} className="tap-button-primary rounded-lg">
            <RotateCcw size={16} />
            {busy === "retry" ? "Retrying..." : "Retry sync"}
          </button>
        )}
        <button type="button" onClick={() => post("cancel")} disabled={Boolean(busy)} className="tap-button-danger rounded-lg">
          <XCircle size={16} />
          {busy === "cancel" ? "Cancelling..." : "Cancel action"}
        </button>
      </div>
      {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
    </div>
  );
}
