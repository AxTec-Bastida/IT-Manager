"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AssetPhoto } from "@prisma/client";
import { Camera, Star, Trash2, Upload } from "lucide-react";
import { assetPhotoTypeLabels, assetPhotoTypeOptions } from "@/lib/constants";

type Props = {
  assetId: string;
  photos: AssetPhoto[];
};

export function AssetPhotoPanel({ assetId, photos }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";

  async function uploadPhoto(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/devices/${assetId}/photos`, { method: "POST", body: formData });
    const data = await response.json();
    setSaving(false);
    setMessage(response.ok ? "Photo uploaded." : data.error || "Photo upload failed.");
    if (response.ok) router.refresh();
  }

  async function setPrimary(photoId: string) {
    const response = await fetch(`/api/devices/${assetId}/photos/${photoId}/primary`, { method: "POST" });
    setMessage(response.ok ? "Primary photo updated." : "Unable to update primary photo.");
    if (response.ok) router.refresh();
  }

  async function deletePhoto(photoId: string) {
    const response = await fetch(`/api/devices/${assetId}/photos/${photoId}`, { method: "DELETE" });
    setMessage(response.ok ? "Photo deleted." : "Unable to delete photo.");
    if (response.ok) router.refresh();
  }

  async function updatePhoto(photoId: string, formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch(`/api/devices/${assetId}/photos/${photoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setMessage(response.ok ? "Photo details updated." : "Unable to update photo.");
    if (response.ok) router.refresh();
  }

  return (
    <section id="photos" className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Photos</h2>
          <p className="text-sm text-slate-500">Asset photos, serial labels, MAC/IP labels, damage, condition, and accessories.</p>
        </div>
      </div>

      <form action={uploadPhoto} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-2">
        {message ? <div className="rounded-md bg-white p-3 text-sm text-slate-700 lg:col-span-2">{message}</div> : null}
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Take or upload photo
          <input className={inputClass} name="file" type="file" accept="image/*,.heic,.heif" capture="environment" required />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Photo type
          <select className={inputClass} name="photoType" defaultValue="OTHER">
            {assetPhotoTypeOptions.map((type) => (
              <option key={type} value={type}>
                {assetPhotoTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Caption
          <input className={inputClass} name="caption" placeholder="Example: serial label under battery cover" />
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm font-medium text-slate-700">
          <input className="size-4" name="isPrimary" type="checkbox" />
          Set as primary photo
        </label>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={saving}>
          <Upload size={17} />
          {saving ? "Uploading..." : "Upload photo"}
        </button>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="relative aspect-[4/3] bg-slate-100">
              <Image src={photo.filePath} alt={photo.caption || assetPhotoTypeLabels[photo.photoType]} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized />
              {photo.isPrimary ? <span className="absolute left-2 top-2 rounded-full bg-slate-950 px-2 py-1 text-xs font-semibold text-white">Primary</span> : null}
            </div>
            <div className="space-y-3 p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-950">{assetPhotoTypeLabels[photo.photoType]}</p>
                <p className="text-slate-500">{photo.caption || "No caption"}</p>
              </div>
              <form action={(formData) => updatePhoto(photo.id, formData)} className="grid gap-2">
                <select className={inputClass} name="photoType" defaultValue={photo.photoType}>
                  {assetPhotoTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {assetPhotoTypeLabels[type]}
                    </option>
                  ))}
                </select>
                <input className={inputClass} name="caption" defaultValue={photo.caption ?? ""} placeholder="Caption" />
                <button className="min-h-12 rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Update caption</button>
              </form>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPrimary(photo.id)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">
                  <Star size={16} />
                  Primary
                </button>
                <button type="button" onClick={() => deletePhoto(photo.id)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 font-semibold text-rose-700 hover:bg-rose-50">
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {photos.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          <Camera className="mx-auto mb-2 text-slate-400" size={24} />
          No photos yet. Use a phone camera to capture the asset, labels, or condition.
        </div>
      ) : null}
    </section>
  );
}
