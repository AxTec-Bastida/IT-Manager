"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { ImageUp, Save } from "lucide-react";

export function MapConfigForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    setSaving(true);
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const response = hasFile
      ? await fetch("/api/maps/upload", { method: "POST", body: formData })
      : await fetch("/api/warehouse-map", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...Object.fromEntries(formData.entries()), active: true }),
        });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to save map configuration.");
      return;
    }
    setMessage(hasFile ? "Map image uploaded and activated." : "Manual map path saved.");
    router.refresh();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <form action={onSubmit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-4">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900 lg:col-span-4">{error}</p> : null}
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Map name
        <input name="name" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="Warehouse main floor" required />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Floor name
        <input name="floorName" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="Floor 1" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
        Upload map image
        <span className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <ImageUp size={16} />
          PNG, JPG, WebP, or safe SVG
        </span>
        <input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onFileChange} className="sr-only" />
      </label>
      {previewUrl ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 lg:col-span-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Selected map preview" className="max-h-72 w-full object-contain" />
        </div>
      ) : null}
      <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-4">
        Notes
        <input name="notes" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="Example: North building, receiving and packing floor." />
      </label>
      <details className="rounded-md border border-slate-200 bg-slate-50 lg:col-span-4">
        <summary className="min-h-12 cursor-pointer px-3 py-3 text-sm font-semibold text-slate-700">Advanced: use an existing public image path</summary>
        <div className="border-t border-slate-200 p-3">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Manual image URL/path
            <input name="imageUrl" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="/warehouse-map.svg" />
          </label>
          <p className="mt-2 text-xs text-slate-500">Upload is preferred. Manual paths are kept only for older maps already stored in public assets.</p>
        </div>
      </details>
      <div className="flex items-end lg:col-span-4">
        <button disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto">
          <Save size={16} />
          {saving ? "Saving..." : "Save map"}
        </button>
      </div>
      {message ? <p className="text-sm text-slate-600 lg:col-span-4">{message}</p> : null}
    </form>
  );
}
