"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Boxes, Tags, FileSpreadsheet } from "lucide-react";
import {
  categoryLabels,
  categoryOptions,
  conditionLabels,
  conditionOptions,
  statusLabels,
  statusOptions,
} from "@/lib/constants";
import { parseMappingCsv, type ValidatedMappingRow } from "@/lib/intake";

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
  const [mode, setMode] = useState<"range" | "mapping">("range");
  const [csvText, setCsvText] = useState("");
  const [validatedRows, setValidatedRows] = useState<ValidatedMappingRow[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [result, setResult] = useState<{ count: number; labels: string; missingPhotos: string; inventory: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function requestPreview(form: HTMLFormElement) {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      if (mode === "range") {
        const response = await fetch("/api/intake/assets/bulk", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...Object.fromEntries(new FormData(form).entries()),
            mappingMode: "range",
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to preview bulk intake.");
        setPreview(data);
        setValidatedRows([]);
      } else {
        const parsed = parseMappingCsv(csvText);
        if (parsed.length === 0) {
          throw new Error("No data rows found. Paste some CSV or TSV text first.");
        }
        const response = await fetch("/api/intake/assets/bulk", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mappingMode: "mapping",
            rows: parsed,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to validate CSV mapping.");
        setValidatedRows(data.validated ?? []);
        setPreview({
          total: parsed.length,
          preview: [],
          existingTags: data.existingTags ?? [],
          labelsHref: "",
        });
      }
    } catch (previewError) {
      setPreview(null);
      setValidatedRows([]);
      setError(previewError instanceof Error ? previewError.message : "Unable to process preview.");
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
    if (mode === "range" && preview.existingTags.length) {
      setError("Resolve duplicate asset tags before creating this batch.");
      return;
    }
    if (mode === "mapping") {
      const hasErrors = validatedRows.some(
        (r) => r.status === "error" || r.status === "duplicate" || r.status === "existing_asset"
      );
      if (hasErrors) {
        setError("Resolve errors (duplicates or existing asset tags) before creating this batch.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      let payload: Record<string, unknown> = {};
      if (mode === "range") {
        payload = {
          ...Object.fromEntries(new FormData(form).entries()),
          mappingMode: "range",
        };
      } else {
        payload = {
          mappingMode: "mapping",
          rows: validatedRows,
          category: form.category.value,
          status: form.status.value,
          condition: form.condition.value,
          brand: form.brand.value,
          model: form.model.value,
          location: form.location.value,
          areaDepartment: form.areaDepartment.value,
        };
      }

      const response = await fetch("/api/intake/assets/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create bulk assets.");
      setResult({
        count: data.count,
        labels: data.links.labels,
        missingPhotos: data.links.missingPhotos,
        inventory: data.links.inventory,
      });
      setPreview(null);
      setValidatedRows([]);
      setCsvText("");
      form.reset();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create bulk assets.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "grid gap-1 text-sm font-semibold text-slate-700";

  function getStatusBadge(status: string) {
    switch (status) {
      case "ready":
        return <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">Ready</span>;
      case "duplicate":
        return <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">Duplicate</span>;
      case "existing_asset":
        return <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">Asset Exists</span>;
      case "existing_serial":
        return <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Serial Exists</span>;
      case "paired_missing":
        return <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Pair Missing</span>;
      case "needs_review":
        return <span className="inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/20">Review</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">Error</span>;
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex border-b border-slate-200 bg-white rounded-t-lg">
        <button
          type="button"
          onClick={() => {
            setMode("range");
            setPreview(null);
            setValidatedRows([]);
            setError(null);
          }}
          className={`border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            mode === "range"
              ? "border-slate-950 text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Mode A: Sequence Range
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("mapping");
            setPreview(null);
            setValidatedRows([]);
            setError(null);
          }}
          className={`border-b-2 px-6 py-3 text-sm font-semibold transition-colors ${
            mode === "mapping"
              ? "border-slate-950 text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Mode B: CSV Mapping
        </button>
      </div>

      <form onSubmit={onSubmit} onChange={() => setPreview(null)} className="space-y-5">
        {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-slate-950 p-3 text-white">
              {mode === "range" ? <Boxes size={20} /> : <FileSpreadsheet size={20} />}
            </div>
            <div>
              <h2 className="font-semibold text-slate-950">
                {mode === "range" ? "Generate serialized assets by range" : "Receive assets via CSV / paste mapping"}
              </h2>
              <p className="text-sm text-slate-600">
                {mode === "range"
                  ? "Specify a tag prefix and number range. The system will auto-generate asset records."
                  : "Paste spreadsheet columns (Asset Tag, Serial, Paired Tag, Area, Location, Notes) to map shipment arrivals."}
              </p>
            </div>
          </div>

          {mode === "range" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
                <span className="font-semibold block mb-1">Pasted Column Format (TSV or CSV):</span>
                Paste columns directly from Excel/Sheets. Recognized fields: <strong>Asset Tag</strong>, <strong>Serial Number</strong>, <strong>Paired Tag</strong> (optional), <strong>Area</strong>, <strong>Location</strong>, <strong>Brand</strong>, <strong>Model</strong>, <strong>Notes</strong>. Header row is optional.
              </div>
              <label className={labelClass}>
                CSV / TSV Text
                <textarea
                  className={`${inputClass} font-mono text-xs`}
                  rows={6}
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    setPreview(null);
                    setValidatedRows([]);
                  }}
                  placeholder="GHT-SLD-001&#9;SN000791&#9;GHT-IPO-001&#10;GHT-SLD-002&#9;SN000792&#9;GHT-IPO-002"
                />
              </label>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Shared Batch Defaults</h3>
            <p className="text-xs text-slate-500">These settings are applied to all assets in this batch if not specified in individual CSV rows.</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className={labelClass}>
                Category
                <select className={inputClass} name="category" defaultValue="SCANNER">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category]}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "range" && (
                <label className={`${labelClass} md:col-span-2`}>
                  Name template
                  <input
                    className={inputClass}
                    name="nameTemplate"
                    defaultValue="Sled {tag}"
                    placeholder="Sled {tag} or Zebra Sled {num}"
                  />
                </label>
              )}
              <label className={labelClass}>
                Status
                <select className={inputClass} name="status" defaultValue="ACTIVE">
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Condition
                <select className={inputClass} name="condition" defaultValue="GOOD">
                  {conditionOptions.map((condition) => (
                    <option key={condition} value={condition}>
                      {conditionLabels[condition]}
                    </option>
                  ))}
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
            </div>
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-800">
              Advanced batch value defaults
            </summary>
            <p className="mt-1 text-sm font-normal text-slate-600">
              Optional shared IT estimate for every asset in this batch. This is not official accounting book value.
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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

          {mode === "range" && (
            <label className={`${labelClass} mt-4`}>
              Serials, optional
              <textarea
                className={inputClass}
                name="serialsText"
                rows={4}
                placeholder="One serial per line. First serial maps to first generated tag."
              />
            </label>
          )}

          <label className={`${labelClass} mt-4`}>
            Notes
            <textarea className={inputClass} name="notes" rows={3} placeholder="Receiving notes for this batch" />
          </label>
        </section>

        {preview && mode === "range" ? (
          <section className={`rounded-lg border p-4 ${preview.existingTags.length ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
            <h2 className="font-semibold text-slate-950">Preview {preview.total} assets</h2>
            {preview.existingTags.length ? (
              <p className="mt-2 text-sm font-semibold text-rose-800">
                Duplicates found: {preview.existingTags.slice(0, 10).join(", ")}
              </p>
            ) : (
              <p className="mt-2 text-sm text-blue-900">No duplicate asset tags found in preview.</p>
            )}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {preview.preview.map((asset) => (
                <div key={asset.assetTag} className="rounded-md bg-white p-3 text-sm border border-slate-200">
                  <p className="font-mono font-semibold text-slate-950">{asset.assetTag}</p>
                  <p className="text-slate-600">{asset.name}</p>
                  {asset.serialNumber ? <p className="text-xs text-slate-500">Serial: {asset.serialNumber}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {validatedRows.length > 0 && mode === "mapping" ? (
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <h2 className="font-semibold text-slate-950">CSV Mapping Validation ({validatedRows.length} rows)</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Asset Tag</th>
                    <th className="px-3 py-2">Serial Number</th>
                    <th className="px-3 py-2">Paired Device</th>
                    <th className="px-3 py-2">Area / Location</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validatedRows.map((row) => (
                    <tr key={row.rowNum} className={row.status !== "ready" ? "bg-amber-50/30" : ""}>
                      <td className="px-3 py-2 font-mono text-slate-500">{row.rowNum}</td>
                      <td className="px-3 py-2 font-semibold text-slate-950">{row.assetTag}</td>
                      <td className="px-3 py-2 text-slate-600">{row.serialNumber || <span className="text-slate-400 italic">None</span>}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.pairedTag ? (
                          <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{row.pairedTag}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {[row.area, row.location].filter(Boolean).join(" • ") || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(row.status)}
                          {row.warnings.map((w, idx) => (
                            <span key={idx} className="text-[10px] text-amber-800 leading-tight block">
                              {w}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <div className="sticky bottom-20 z-10 grid gap-2 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:grid-cols-2 lg:bottom-0">
          <button
            type="button"
            onClick={(event) => requestPreview(event.currentTarget.form!)}
            disabled={saving}
            className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {saving ? "Working..." : mode === "range" ? "Preview batch" : "Validate CSV rows"}
          </button>
          <button
            disabled={
              saving ||
              !preview ||
              (mode === "range" && Boolean(preview.existingTags.length)) ||
              (mode === "mapping" &&
                validatedRows.some((r) => r.status === "error" || r.status === "duplicate" || r.status === "existing_asset"))
            }
            className="inline-flex min-h-14 items-center justify-center rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Create batch
          </button>
        </div>

        {result ? (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="font-semibold text-emerald-950">Created {result.count} assets</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Link href={result.inventory} className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white">
                View assets
              </Link>
              <Link href={result.labels} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">
                <Tags size={16} />
                Generate labels
              </Link>
              <Link href={result.missingPhotos} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">
                Missing photos queue
              </Link>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setPreview(null);
                  setValidatedRows([]);
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800"
              >
                Create another batch
              </button>
            </div>
          </section>
        ) : null}
      </form>
    </div>
  );
}
