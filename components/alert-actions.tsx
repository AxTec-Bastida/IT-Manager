"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AlertStatus } from "@prisma/client";

export type AlertActionMode = "idle" | "resolve" | "ignore";

export function alertActionSuccessMessage(status: AlertStatus) {
  if (status === "ACKNOWLEDGED") return "Alert acknowledged.";
  if (status === "RESOLVED") return "Alert resolved.";
  if (status === "IGNORED") return "Alert ignored.";
  return "Alert updated.";
}

export function getAlertActionPanel(mode: AlertActionMode) {
  if (mode === "resolve") return { showNote: true, label: "Resolution note optional", placeholder: "What fixed or closed this alert?", confirmStatus: "RESOLVED" as AlertStatus, confirmLabel: "Confirm Resolve" };
  if (mode === "ignore") return { showNote: true, label: "Ignore reason optional", placeholder: "Why can this alert be ignored?", confirmStatus: "IGNORED" as AlertStatus, confirmLabel: "Confirm Ignore" };
  return { showNote: false, label: "", placeholder: "", confirmStatus: null, confirmLabel: "" };
}

export function AlertActions({ alertId, status }: { alertId: string; status: AlertStatus }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<AlertActionMode>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panel = getAlertActionPanel(mode);
  const isClosed = status === "RESOLVED" || status === "IGNORED";

  async function setStatus(nextStatus: AlertStatus, resolutionNote?: string) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, ...(resolutionNote != null ? { resolutionNote } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update alert. Try again.");
      setMessage(alertActionSuccessMessage(nextStatus));
      setMode("idle");
      setNote("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update alert. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      {message ? <p className={`rounded-md p-3 text-sm ${message.startsWith("Could not") || message.startsWith("Cannot") ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</p> : null}
      {!isClosed ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" disabled={saving} onClick={() => setStatus("ACKNOWLEDGED")} className="min-h-12 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Acknowledge</button>
          <button type="button" disabled={saving} onClick={() => setMode(mode === "resolve" ? "idle" : "resolve")} className="min-h-12 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">Resolve</button>
          <button type="button" disabled={saving} onClick={() => setMode(mode === "ignore" ? "idle" : "ignore")} className="min-h-12 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Ignore</button>
        </div>
      ) : (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">This alert is already {status.toLowerCase()}.</p>
      )}
      {panel.showNote && panel.confirmStatus ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="block text-sm font-semibold text-slate-700">
            {panel.label}
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-normal text-slate-950 sm:text-sm" placeholder={panel.placeholder} />
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={saving} onClick={() => setStatus(panel.confirmStatus!, note)} className="min-h-12 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{saving ? "Saving..." : panel.confirmLabel}</button>
            <button type="button" disabled={saving} onClick={() => { setMode("idle"); setNote(""); }} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
