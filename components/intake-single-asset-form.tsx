"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AssetPhotoType, Factura } from "@prisma/client";
import { Camera, CheckCircle, Tags } from "lucide-react";
import { CameraCapture } from "@/components/camera-capture";
import { assetPhotoTypeLabels, categoryLabels, categoryOptions, conditionLabels, conditionOptions, statusLabels, statusOptions } from "@/lib/constants";

type CreatedAsset = {
  id: string;
  assetTag: string | null;
  name: string;
};

type ControlledValueItem = { id: string; type: string; name: string; isActive: boolean };
type Props = {
  facturas: Factura[];
  controlledValues?: ControlledValueItem[];
};

const recommendedPhotoTypes: AssetPhotoType[] = ["OVERVIEW", "ASSET_TAG", "SERIAL_LABEL", "CONDITION"];
type IntakePhotoSelection = { file: File; source: "CAMERA" | "GALLERY" | "UNKNOWN"; compressionApplied: boolean };

export function IntakeSingleAssetForm({ facturas }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdAsset, setCreatedAsset] = useState<CreatedAsset | null>(null);
  const [links, setLinks] = useState<{ openAsset: string; addPhotos: string; labels: string } | null>(null);
  const [photoFiles, setPhotoFiles] = useState<Partial<Record<AssetPhotoType, IntakePhotoSelection>>>({});
  const [resetToken, setResetToken] = useState(0);
  const [category, setCategory] = useState("");
  const [chargerIncluded, setChargerIncluded] = useState(true);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);
  const [assetTagValue, setAssetTagValue] = useState("");
  const [tagSuggestionLoading, setTagSuggestionLoading] = useState(false);

  async function fetchSuggestedTag(cat: string) {
    if (!cat) return;
    setTagSuggestionLoading(true);
    try {
      const res = await fetch(`/api/devices/suggest-tag?category=${encodeURIComponent(cat)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestedTag(data.suggested ?? null);
      }
    } finally {
      setTagSuggestionLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      if (category === "LAPTOP") {
        (payload as Record<string, unknown>).chargerIncluded = chargerIncluded;
      }
      const response = await fetch("/api/intake/assets/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create asset.");
      setCreatedAsset(data.device);
      setLinks(data.links);
      const uploadResults = await uploadSelectedPhotos(data.device.id, photoFiles);
      setMessage(uploadResults ? `Asset created. ${uploadResults}` : "Asset created. Add photos later if needed.");
      form.reset();
      setPhotoFiles({});
      setResetToken((value) => value + 1);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create asset.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "grid gap-1 text-sm font-semibold text-slate-700";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</div> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Asset details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Asset tag
            <input
              className={inputClass}
              name="assetTag"
              required
              placeholder="GHT-LP-123"
              value={assetTagValue}
              onChange={(e) => setAssetTagValue(e.target.value)}
            />
            {suggestedTag && !assetTagValue && (
              <div className="mt-1 flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
                <span className="text-slate-600">Suggested: <strong>{suggestedTag}</strong></span>
                <button
                  type="button"
                  onClick={() => setAssetTagValue(suggestedTag)}
                  className="ml-auto rounded bg-slate-950 px-3 py-1 text-xs font-semibold text-white"
                >
                  Use suggested tag
                </button>
              </div>
            )}
            {tagSuggestionLoading && <p className="mt-1 text-xs text-slate-500">Finding next available tag…</p>}
          </label>
          <label className={labelClass}>
            Name / model
            <input className={inputClass} name="name" required placeholder="DELL Latitude 5520" />
          </label>
          <label className={labelClass}>
            Category
            <select
              className={inputClass}
              name="category"
              defaultValue="LAPTOP"
              onChange={(e) => {
                setCategory(e.target.value);
                fetchSuggestedTag(e.target.value);
                if (e.target.value === "LAPTOP") setChargerIncluded(true);
              }}
            >
              {categoryOptions.map((cat) => <option key={cat} value={cat}>{categoryLabels[cat]}</option>)}
            </select>
          </label>
          {category === "LAPTOP" && (
            <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                type="checkbox"
                id="chargerIncluded"
                checked={chargerIncluded}
                onChange={(e) => setChargerIncluded(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="chargerIncluded" className="text-sm font-medium text-slate-700">
                Has charger
                <span className="ml-1 font-normal text-slate-500">
                  {chargerIncluded ? "— Charger included with this laptop" : "— No charger / missing charger"}
                </span>
              </label>
            </div>
          )}
          <label className={labelClass}>
            Serial number
            <input className={inputClass} name="serialNumber" placeholder="Serial / S/N" />
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
            <input className={inputClass} name="brand" placeholder="DELL, Zebra, Apple" />
          </label>
          <label className={labelClass}>
            Model
            <input className={inputClass} name="model" placeholder="Latitude 5520, TC52, etc." />
          </label>
          <label className={labelClass}>
            Location
            <input className={inputClass} name="location" placeholder="IT cage, Packing, Receiving" />
          </label>
          <label className={labelClass}>
            Area / department
            <input className={inputClass} name="areaDepartment" placeholder="Ops > Pack" />
          </label>
          <label className={labelClass}>
            Responsibility target
            <input className={inputClass} name="assignedTo" placeholder="IT Stock, Operations, Ops > Pack" />
          </label>
          <label className={labelClass}>
            Purchase date
            <input className={inputClass} name="purchaseDate" type="date" />
          </label>
          <label className={labelClass}>
            Warranty expiration
            <input className={inputClass} name="warrantyExpiresAt" type="date" />
          </label>
          <label className={labelClass}>
            Factura
            <select className={inputClass} name="facturaId" defaultValue="">
              <option value="">No factura link</option>
              {facturas.map((factura) => <option key={factura.id} value={factura.id}>{factura.facturaNumber} - {factura.vendorName}</option>)}
            </select>
          </label>
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-800">Advanced internal asset value</summary>
            <p className="mt-1 text-sm font-normal text-slate-600">Optional IT estimate only. This is not official accounting book value.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Purchase value
                <input className={inputClass} name="purchaseValue" type="number" min="0.01" step="0.01" placeholder="1000.00" />
              </label>
              <label className={labelClass}>
                Currency
                <input className={inputClass} name="valueCurrency" defaultValue="MXN" maxLength={8} />
              </label>
              <label className={labelClass}>
                Useful life months
                <input className={inputClass} name="usefulLifeMonths" type="number" min="1" placeholder="Default by category" />
              </label>
              <label className={labelClass}>
                Residual percent
                <input className={inputClass} name="residualPercent" type="number" min="0" max="100" step="0.01" placeholder="30" />
              </label>
            </div>
          </details>
          <label className={`${labelClass} md:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={3} placeholder="Intake notes, accessories, packaging, receiving condition" />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-950 p-3 text-white">
            <Camera size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-950">Recommended photos</h2>
            <p className="text-sm text-slate-600">Optional during intake. Capture now for important devices or leave bulk-style photo work for later.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {recommendedPhotoTypes.map((type) => (
            <div key={type} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{assetPhotoTypeLabels[type]}</p>
              <CameraCapture
                photoType={type}
                disabled={saving}
                resetToken={resetToken}
                onPhotoReady={(file, metadata) => {
                  setPhotoFiles((current) => ({ ...current, [type]: { file, source: metadata?.source ?? "UNKNOWN", compressionApplied: Boolean(metadata?.compressionApplied) } }));
                }}
              />
              {photoFiles[type] ? <p className="text-xs font-semibold text-emerald-700">Ready: {photoFiles[type]?.file.name}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-20 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-0">
        <button disabled={saving} className="inline-flex min-h-14 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {saving ? "Creating..." : "Create asset"}
        </button>
      </div>

      {createdAsset && links ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-1 text-emerald-700" size={20} />
            <div>
              <h2 className="font-semibold text-emerald-950">Created {createdAsset.assetTag || createdAsset.name}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link href={links.openAsset} className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white">Open asset</Link>
                <Link href={links.addPhotos} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">Add more photos</Link>
                <Link href={links.labels} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800"><Tags size={16} />Generate label</Link>
                <button type="button" onClick={() => setCreatedAsset(null)} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">Create another</button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </form>
  );
}

async function uploadSelectedPhotos(assetId: string, files: Partial<Record<AssetPhotoType, IntakePhotoSelection>>) {
  const entries = Object.entries(files) as Array<[AssetPhotoType, IntakePhotoSelection]>;
  if (!entries.length) return "";
  let uploaded = 0;
  for (const [photoType, selection] of entries) {
    const formData = new FormData();
    formData.set("file", selection.file);
    formData.set("photoType", photoType);
    formData.set("caption", assetPhotoTypeLabels[photoType]);
    formData.set("source", selection.source);
    formData.set("compressionApplied", String(selection.compressionApplied));
    const response = await fetch(`/api/devices/${assetId}/photos`, { method: "POST", body: formData });
    if (response.ok) uploaded += 1;
  }
  return uploaded === entries.length ? `${uploaded} photo${uploaded === 1 ? "" : "s"} uploaded.` : `${uploaded} of ${entries.length} photos uploaded. Asset record was saved.`;
}
