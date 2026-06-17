"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Boxes, Tags } from "lucide-react";
import { categoryLabels, categoryOptions, conditionLabels, conditionOptions, statusLabels, statusOptions } from "@/lib/constants";

type PreviewAsset = {
  assetTag: string;
  name: string;
  serialNumber: string | null;
  number: number;
  valuePreview?: {
    purchaseValue: number;
    currency: string;
    currentEstimatedValue: number | null;
    usefulLifeMonths: number;
  } | null;
};

type PreviewState = {
  total: number;
  preview: PreviewAsset[];
  existingTags: string[];
  labelsHref: string;
};

export function IntakeBulkAssetsForm() {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [result, setResult] = useState<{ count: number; labels: string; missingPhotos: string; inventory: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function requestPreview(form: HTMLFormElement) {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/intake/assets/bulk", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to preview bulk intake.");
      setPreview(data);
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "Unable to preview bulk intake.");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!preview) {
      await requestPreview(form);
      return;
    }
    if (preview.existingTags.length) {
      setError("Resolve duplicate asset tags before creating this batch.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/intake/assets/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create bulk assets.");
      setResult({ count: data.count, labels: data.links.labels, missingPhotos: data.links.missingPhotos, inventory: data.links.inventory });
      setPreview(null);
      form.reset();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create bulk assets.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "grid gap-1 text-sm font-semibold text-slate-700";

  return (
    <form onSubmit={onSubmit} onChange={() => setPreview(null)} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-950 p-3 text-white"><Boxes size={20} /></div>
          <div>
            <h2 className="font-semibold text-slate-950">Generate serialized assets</h2>
            <p className="text-sm text-slate-600">Preview first. Photos are intentionally left for the Missing Photos queue later.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>
            Prefix
            <input className={inputClass} name="prefix" required defaultValue="GHT-SLD" placeholder="GHT-SLD" />
          </label>
          <label className={labelClass}>
            Separator
            <input className={inputClass} name="separator" defaultValue="-" placeholder="-" />
          </label>
          <label className={labelClass}>
            Start
            <input className={inputClass} name="start" type="number" min="0" required defaultValue="1" />
          </label>
          <label className={labelClass}>
            End
            <input className={inputClass} name="end" type="number" min="0" required defaultValue="3" />
          </label>
          <label className={labelClass}>
            Zero padding
            <input className={inputClass} name="padding" type="number" min="0" max="12" defaultValue="3" />
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} name="category" defaultValue="SCANNER">
              {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Name template
            <input className={inputClass} name="nameTemplate" defaultValue="Sled {tag}" placeholder="Sled {tag} or Zebra Sled {num}" />
          </label>
          <label className={labelClass}>
            Status
            <select className={inputClass} name="status" defaultValue="ACTIVE">
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Condition
            <select className={inputClass} name="condition" defaultValue="GOOD">
              {conditionOptions.map((condition) => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Brand
            <input className={inputClass} name="brand" placeholder="Zebra, DELL, Apple" />
          </label>
          <label className={labelClass}>
            Model
            <input className={inputClass} name="model" placeholder="Model shared by this batch" />
          </label>
          <label className={labelClass}>
            Location
            <input className={inputClass} name="location" placeholder="IT cage shelf A" />
          </label>
          <label className={labelClass}>
            Area / department
            <input className={inputClass} name="areaDepartment" placeholder="IT Stock" />
          </label>
          <label className={labelClass}>
            Responsibility target
            <input className={inputClass} name="assignedTo" placeholder="IT Stock, Operations" />
          </label>
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2 lg:col-span-4">
            <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-800">Advanced batch value defaults</summary>
            <p className="mt-1 text-sm font-normal text-slate-600">Optional shared IT estimate for every asset in this batch. This is not official accounting book value.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className={labelClass}>
                Purchase value
                <input className={inputClass} name="purchaseValue" type="number" min="0.01" step="0.01" placeholder="1000.00" />
              </label>
              <label className={labelClass}>
                Currency
                <input className={inputClass} name="valueCurrency" defaultValue="MXN" maxLength={8} />
              </label>
              <label className={labelClass}>
                Purchase date
                <input className={inputClass} name="purchaseDate" type="date" />
              </label>
              <label className={labelClass}>
                Useful life months
                <input className={inputClass} name="usefulLifeMonths" type="number" min="1" placeholder="Default" />
              </label>
              <label className={labelClass}>
                Residual percent
                <input className={inputClass} name="residualPercent" type="number" min="0" max="100" step="0.01" placeholder="30" />
              </label>
            </div>
          </details>
          <label className={`${labelClass} md:col-span-2 lg:col-span-4`}>
            Serials, optional
            <textarea className={inputClass} name="serialsText" rows={4} placeholder="One serial per line. First serial maps to first generated tag." />
          </label>
          <label className={`${labelClass} md:col-span-2 lg:col-span-4`}>
            Notes
            <textarea className={inputClass} name="notes" rows={3} placeholder="Receiving notes for this batch" />
          </label>
        </div>
      </section>

      {preview ? (
        <section className={`rounded-lg border p-4 ${preview.existingTags.length ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
          <h2 className="font-semibold text-slate-950">Preview {preview.total} assets</h2>
          {preview.existingTags.length ? <p className="mt-2 text-sm font-semibold text-rose-800">Duplicates found: {preview.existingTags.slice(0, 10).join(", ")}</p> : <p className="mt-2 text-sm text-blue-900">No duplicate asset tags found in preview.</p>}
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {preview.preview.map((asset) => (
              <div key={asset.assetTag} className="rounded-md bg-white p-3 text-sm">
                <p className="font-mono font-semibold text-slate-950">{asset.assetTag}</p>
                <p className="text-slate-600">{asset.name}</p>
                {asset.serialNumber ? <p className="text-xs text-slate-500">Serial: {asset.serialNumber}</p> : null}
                {asset.valuePreview ? <p className="text-xs text-slate-500">Value: {asset.valuePreview.currency} {asset.valuePreview.purchaseValue} / life {asset.valuePreview.usefulLifeMonths} months</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-20 z-10 grid gap-2 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:grid-cols-2 lg:bottom-0">
        <button type="button" onClick={(event) => requestPreview(event.currentTarget.form!)} disabled={saving} className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">
          {saving ? "Working..." : "Preview batch"}
        </button>
        <button disabled={saving || !preview || Boolean(preview.existingTags.length)} className="inline-flex min-h-14 items-center justify-center rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          Create batch
        </button>
      </div>

      {result ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-950">Created {result.count} assets</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link href={result.inventory} className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white">View assets</Link>
            <Link href={result.labels} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800"><Tags size={16} />Generate labels</Link>
            <Link href={result.missingPhotos} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">Missing photos queue</Link>
            <button type="button" onClick={() => setResult(null)} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">Create another batch</button>
          </div>
        </section>
      ) : null}
    </form>
  );
}
