"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/badge";
import type { DecommissionBlocker, DecommissionChecklistItem, DecommissionWarning } from "@/lib/decommission";
import { decommissionReasonLabels, notesRequiredReasons } from "@/lib/decommission";

const reasons = [
  "RETIRED",
  "DISPOSED",
  "RECYCLED",
  "LOST",
  "STOLEN",
  "DESTROYED",
  "DONATED",
  "SOLD",
  "RETURNED_TO_VENDOR",
  "OTHER",
] as const;

type Props = {
  deviceId: string;
  assetName: string;
  assetTag: string | null;
  categoryLabel: string;
  statusLabel: string;
  blockers: DecommissionBlocker[];
  warnings: DecommissionWarning[];
  checklist: DecommissionChecklistItem[];
  canSubmit: boolean;
};

export function DecommissionAssetForm({ deviceId, assetName, assetTag, categoryLabel, statusLabel, blockers, warnings, checklist, canSubmit }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState<(typeof reasons)[number]>("RETIRED");
  const [notes, setNotes] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const notesRequired = notesRequiredReasons.has(reason);
  const checkedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const blocked = blockers.length > 0 || !canSubmit;

  async function submit() {
    setMessage(null);
    if (blocked) {
      setMessage("Close the blocking workflow records before decommissioning this asset.");
      return;
    }
    if (!confirmed) {
      setMessage("Confirm that you understand this removes the asset from active inventory.");
      return;
    }
    if (notesRequired && !notes.trim()) {
      setMessage(`${decommissionReasonLabels[reason]} requires notes.`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/devices/${deviceId}/decommission`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason,
          notes,
          approvedByName,
          checklist: checked,
          confirmation: "I understand this removes the asset from active inventory.",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to decommission asset.");
      router.push(`/devices/${deviceId}?decommissioned=1`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to decommission asset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-32">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 shrink-0 text-amber-700" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-amber-950">Controlled decommission workflow</h2>
            <p className="mt-1 text-sm text-amber-900">
              This changes asset lifecycle status and creates an audit record. It does not delete assignments, loans, RMA history, photos, facturas, labels, aliases, audit records, or activity logs.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Confirm asset</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">{assetName}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{assetTag || "No tag"}</Badge>
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabel}</Badge>
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{statusLabel}</Badge>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Reason</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {reasons.map((item) => (
            <label key={item} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm font-semibold ${reason === item ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
              <input className="sr-only" type="radio" name="reason" value={item} checked={reason === item} onChange={() => setReason(item)} />
              {decommissionReasonLabels[item]}
            </label>
          ))}
        </div>
        {["LOST", "STOLEN", "DESTROYED"].includes(reason) ? (
          <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-900">This reason requires Admin permission.</p>
        ) : null}
      </section>

      {blockers.length ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-rose-950"><AlertTriangle size={18} /> Blocking records</h2>
          <div className="mt-3 grid gap-2">
            {blockers.map((blocker) => (
              <div key={blocker.type} className="rounded-md bg-white p-3 text-sm text-rose-950">
                <p className="font-semibold">{blocker.message}</p>
                {blocker.href ? <Link href={blocker.href} className="mt-2 inline-flex min-h-11 items-center rounded-md border border-rose-200 px-3 font-semibold text-rose-900">Open blocker</Link> : null}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> No active assignment, loan, or RMA blockers found.</p>
        </section>
      )}

      {warnings.length ? (
        <section className="rounded-lg border border-amber-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Review warnings</h2>
          <div className="mt-3 grid gap-2">
            {warnings.map((warning) => (
              <div key={`${warning.type}-${warning.message}`} className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">
                <p>{warning.message}</p>
                {warning.href ? <Link href={warning.href} className="mt-2 inline-flex min-h-11 items-center rounded-md border border-amber-200 bg-white px-3 font-semibold text-amber-900">Open related record</Link> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Checklist</h2>
        <p className="mt-1 text-sm text-slate-500">{checkedCount} of {checklist.length} checked. Checklist items are stored in the audit record.</p>
        <div className="mt-3 grid gap-2">
          {checklist.map((item) => (
            <label key={item.id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                className="mt-1 size-5 rounded border-slate-300"
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))}
              />
              <span>
                <span className="font-semibold text-slate-950">{item.label}</span>
                {item.recommended ? <span className="ml-2 text-xs font-semibold text-slate-500">Recommended</span> : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Notes and evidence</h2>
        <label className="mt-3 block space-y-1 text-sm font-medium text-slate-700">
          Approval / disposal notes {notesRequired ? <span className="text-rose-700">(required)</span> : null}
          <textarea className="min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-base" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="mt-3 block space-y-1 text-sm font-medium text-slate-700">
          Approved by / reference
          <input className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base" value={approvedByName} onChange={(event) => setApprovedByName(event.target.value)} placeholder="Manager, ticket, vendor, or approval reference" />
        </label>
        <div className="mt-4 grid gap-2 sm:flex">
          <Link href={`/devices/${deviceId}#photos`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Camera size={17} />
            Add evidence photo
          </Link>
          <Link href={`/photos/compliance?q=${encodeURIComponent(assetTag || assetName)}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Open photo compliance
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-rose-200 bg-white p-4">
        <label className="flex min-h-14 cursor-pointer items-start gap-3 text-sm text-slate-700">
          <input className="mt-1 size-5 rounded border-slate-300" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>
            <span className="font-semibold text-slate-950">I understand this removes the asset from active inventory.</span>
            <span className="mt-1 block">The record and history are preserved for audit lookup.</span>
          </span>
        </label>
        {message ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-900">{message}</p> : null}
      </section>

      <div className="fixed inset-x-3 bottom-24 z-30 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <button
          type="button"
          onClick={submit}
          disabled={saving || blocked || !confirmed || (notesRequired && !notes.trim())}
          className="min-h-14 w-full rounded-lg bg-rose-700 px-4 text-base font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? "Saving..." : blocked ? "Resolve blockers first" : "Confirm decommission"}
        </button>
      </div>
    </div>
  );
}
