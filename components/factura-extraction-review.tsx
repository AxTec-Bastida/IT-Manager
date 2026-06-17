"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeviceCategory } from "@prisma/client";
import { FileSearch, Save, Trash2 } from "lucide-react";
import { categoryLabels, categoryOptions } from "@/lib/constants";

type Candidate = {
  description: string;
  sku?: string | null;
  model?: string | null;
  category?: DeviceCategory | null;
  quantity?: number | null;
  unitCost?: number | null;
  totalCost?: number | null;
  currency: string;
  confidence: number;
  rawTextSnippet: string;
  warnings: string[];
  selected: boolean;
  notes?: string | null;
};

type Props = {
  facturaId: string;
  hasExistingLineItems: boolean;
};

export function FacturaExtractionReview({ facturaId, hasExistingLineItems }: Props) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  async function extract() {
    setExtracting(true);
    setMessage(null);
    setWarnings([]);
    const response = await fetch(`/api/facturas/${facturaId}/extract-line-items`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setExtracting(false);
    if (!response.ok) {
      setMessage(data.error || "Could not extract line item candidates.");
      setCandidates([]);
      return;
    }
    setAttemptId(data.attemptId ?? null);
    setWarnings(data.warnings ?? []);
    setCandidates((data.candidates ?? []).map((candidate: Candidate) => ({ ...candidate, selected: true, category: null, quantity: candidate.quantity ?? 1, unitCost: candidate.unitCost ?? 0, notes: "" })));
    setMessage((data.candidates ?? []).length ? "Review and edit candidates before creating line items." : "No selectable line item candidates were found. Enter line items manually.");
  }

  async function createSelected() {
    setSaving(true);
    setMessage(null);
    const selected = candidates.filter((candidate) => candidate.selected);
    const response = await fetch(`/api/facturas/${facturaId}/line-items/from-candidates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId,
        allowDuplicates,
        candidates: selected.map((candidate) => ({
          description: candidate.description,
          sku: candidate.sku || null,
          model: candidate.model || null,
          category: candidate.category || null,
          quantity: candidate.quantity,
          unitCost: candidate.unitCost,
          currency: candidate.currency || "MXN",
          notes: candidate.notes || null,
          sourceConfidence: candidate.confidence,
          rawTextSnippet: candidate.rawTextSnippet,
          selected: true,
        })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Could not create selected line items.");
      return;
    }
    setMessage(`Created ${data.createdCount ?? selected.length} line item(s).`);
    router.push(`/facturas/${facturaId}`);
    router.refresh();
  }

  function updateCandidate(index: number, patch: Partial<Candidate>) {
    setCandidates((current) => current.map((candidate, candidateIndex) => (candidateIndex === index ? { ...candidate, ...patch } : candidate)));
  }

  const selectedCount = candidates.filter((candidate) => candidate.selected).length;
  const inputClass = "min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-slate-950 focus:outline-none";

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Extract Candidates</h2>
            <p className="mt-1 text-sm text-slate-600">Selectable PDF text is parsed locally. Review every candidate before creating line items.</p>
          </div>
          <button onClick={extract} disabled={extracting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            <FileSearch size={16} />
            {extracting ? "Extracting..." : "Extract line items"}
          </button>
        </div>
        {hasExistingLineItems ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">This factura already has line items. Review carefully before adding duplicates.</p> : null}
        {warnings.length ? <div className="mt-3 grid gap-2">{warnings.map((warning) => <p key={warning} className="rounded-md bg-slate-50 p-2 text-sm text-slate-700">{warning}</p>)}</div> : null}
        {message ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
      </section>

      {candidates.length ? (
        <section className="grid gap-3">
          {candidates.map((candidate, index) => (
            <article key={`${candidate.rawTextSnippet}-${index}`} className={`rounded-lg border p-4 ${candidate.selected ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-75"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Candidate {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{candidate.description}</h3>
                  <p className="mt-1 text-sm text-slate-500">Confidence {Math.round(candidate.confidence * 100)}%</p>
                </div>
                <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={candidate.selected} onChange={(event) => updateCandidate(index, { selected: event.target.checked })} />
                  Create
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
                  Description
                  <input className={inputClass} value={candidate.description} onChange={(event) => updateCandidate(index, { description: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  SKU
                  <input className={inputClass} value={candidate.sku ?? ""} onChange={(event) => updateCandidate(index, { sku: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Model
                  <input className={inputClass} value={candidate.model ?? ""} onChange={(event) => updateCandidate(index, { model: event.target.value })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Category
                  <select className={inputClass} value={candidate.category ?? ""} onChange={(event) => updateCandidate(index, { category: (event.target.value || null) as DeviceCategory | null })}>
                    <option value="">No category</option>
                    {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Quantity
                  <input className={inputClass} type="number" min="1" value={candidate.quantity ?? 1} onChange={(event) => updateCandidate(index, { quantity: Number(event.target.value) })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Unit cost
                  <input className={inputClass} type="number" min="0" step="0.01" value={candidate.unitCost ?? 0} onChange={(event) => updateCandidate(index, { unitCost: Number(event.target.value) })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Currency
                  <input className={inputClass} value={candidate.currency} maxLength={8} onChange={(event) => updateCandidate(index, { currency: event.target.value.toUpperCase() })} />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
                  Notes
                  <textarea className={inputClass} rows={3} value={candidate.notes ?? ""} onChange={(event) => updateCandidate(index, { notes: event.target.value })} />
                </label>
              </div>

              {candidate.warnings.length ? <div className="mt-3 grid gap-2">{candidate.warnings.map((warning) => <p key={warning} className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">{warning}</p>)}</div> : null}
              <details className="mt-3 text-sm text-slate-500">
                <summary className="cursor-pointer font-semibold text-slate-700">Source snippet</summary>
                <p className="mt-2 rounded-md bg-slate-50 p-3">{candidate.rawTextSnippet}</p>
              </details>
              <button type="button" onClick={() => updateCandidate(index, { selected: false })} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Trash2 size={15} />
                Discard
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {candidates.length ? (
        <div className="sticky bottom-20 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-0">
          <label className="mb-3 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={allowDuplicates} onChange={(event) => setAllowDuplicates(event.target.checked)} />
            Allow possible duplicates after review
          </label>
          <button disabled={saving || selectedCount === 0} onClick={createSelected} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
            <Save size={16} />
            {saving ? "Creating..." : `Create selected line items (${selectedCount})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
