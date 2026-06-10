"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AssetPhoto, AssetPhotoType } from "@prisma/client";
import { Camera, Star, Trash2, Upload } from "lucide-react";
import { CameraCapture } from "@/components/camera-capture";
import { uploadFailureMessage } from "@/lib/camera";
import { assetPhotoTypeLabels, assetPhotoTypeOptions } from "@/lib/constants";
import { buildPhotoChecklist, requiredPhotoLabels, type PhotoComplianceAsset } from "@/lib/photo-compliance";

type Props = {
  assetId: string;
  photos: AssetPhoto[];
  asset?: PhotoComplianceAsset;
};

export function AssetPhotoPanel({ assetId, photos, asset }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPhotoType = normalizeClientPhotoType(searchParams.get("photoType"));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoMetadata, setPhotoMetadata] = useState<{ source: "CAMERA" | "GALLERY" | "UNKNOWN"; compressionApplied: boolean }>({ source: "UNKNOWN", compressionApplied: false });
  const [selectedPhotoType, setSelectedPhotoType] = useState<AssetPhotoType>(requestedPhotoType);
  const [caption, setCaption] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const inputClass = "w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";
  const checklist = asset ? buildPhotoChecklist({ ...asset, photos }) : null;

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setMessage("Take a photo or choose one from the gallery first.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setUploadProgress(0);
    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("photoType", selectedPhotoType);
    formData.set("caption", caption);
    formData.set("source", photoMetadata.source);
    formData.set("compressionApplied", String(photoMetadata.compressionApplied));
    if (isPrimary) formData.set("isPrimary", "true");
    try {
      await uploadPhotoWithProgress(`/api/devices/${assetId}/photos`, formData, setUploadProgress);
      setMessage("Photo uploaded.");
      setSelectedFile(null);
      setPhotoMetadata({ source: "UNKNOWN", compressionApplied: false });
      setCaption("");
      setIsPrimary(false);
      setUploadProgress(null);
      setResetToken((value) => value + 1);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : uploadFailureMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function setPrimary(photoId: string) {
    const response = await fetch(`/api/devices/${assetId}/photos/${photoId}/primary`, { method: "POST" });
    setMessage(response.ok ? "Primary photo updated." : "Unable to update primary photo.");
    if (response.ok) router.refresh();
  }

  async function deletePhoto(photoId: string) {
    const confirmed = window.confirm("Delete this photo? This may permanently remove the file unless restored from backup.");
    if (!confirmed) return;
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
          <p className="mt-1 text-xs text-amber-800">Photo deletion is permanent until soft-delete is added. Backups must include uploads/assets.</p>
        </div>
      </div>

      {checklist ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-950">Photo checklist</h3>
              <p className="text-sm text-slate-500">Recommended photos for audit readiness. Missing items are review-only for now.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${checklist.missing.length ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
              {checklist.missing.length ? `${checklist.missing.length} missing` : "Complete"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.items.map((item) => (
              <a key={item.type} href="#photos" className={`rounded-md border p-3 text-sm ${item.complete ? "border-emerald-200 bg-white text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                <span className="font-semibold">{requiredPhotoLabels[item.type]}</span>
                <span className="mt-1 block text-xs">{item.complete ? "Complete" : "Missing - add photo"}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={uploadPhoto} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-2">
        {message ? <div className="rounded-md bg-white p-3 text-sm text-slate-700 lg:col-span-2">{message}</div> : null}
        <div className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Take or upload photo
          <CameraCapture
            photoType={selectedPhotoType}
            disabled={saving}
            resetToken={resetToken}
            onPhotoReady={(file, metadata) => {
              setSelectedFile(file);
              setPhotoMetadata({ source: metadata?.source ?? "UNKNOWN", compressionApplied: Boolean(metadata?.compressionApplied) });
              setMessage(`Photo ready: ${file.name} (${Math.ceil(file.size / 1024)} KB). ${metadata?.compressionApplied ? "Resized before upload." : "No resize needed."}`);
            }}
          />
        </div>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Photo type
          <select className={inputClass} name="photoType" value={selectedPhotoType} onChange={(event) => setSelectedPhotoType(normalizeClientPhotoType(event.target.value))}>
            {assetPhotoTypeOptions.map((type) => (
              <option key={type} value={type}>
                {assetPhotoTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Caption
          <input className={inputClass} name="caption" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Example: serial label under battery cover" />
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm font-medium text-slate-700">
          <input className="size-4" name="isPrimary" type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} />
          Set as primary photo
        </label>
        {uploadProgress !== null ? (
          <div className="rounded-md bg-white p-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>{saving ? "Uploading..." : "Upload progress"}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-slate-950 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : null}
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={saving}>
          <Upload size={17} />
          {saving ? "Uploading..." : "Upload photo"}
        </button>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="relative aspect-[4/3] bg-slate-100">
              <a href={photo.filePath} target="_blank" rel="noreferrer" className="block h-full w-full">
                <Image src={photo.thumbnailPath || photo.filePath} alt={photo.caption || assetPhotoTypeLabels[photo.photoType]} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized loading="lazy" />
              </a>
              {photo.isPrimary ? <span className="absolute left-2 top-2 rounded-full bg-slate-950 px-2 py-1 text-xs font-semibold text-white">Primary</span> : null}
            </div>
            <div className="space-y-3 p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-950">{assetPhotoTypeLabels[photo.photoType]}</p>
                <p className="text-slate-500">{photo.caption || "No caption"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {photo.thumbnailPath ? "Thumbnail ready" : "No thumbnail yet"} / {Math.ceil((photo.sizeBytes ?? photo.fileSize) / 1024)} KB
                </p>
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

function normalizeClientPhotoType(value: unknown): AssetPhotoType {
  const text = String(value || "OTHER").toUpperCase();
  return assetPhotoTypeOptions.includes(text as AssetPhotoType) ? (text as AssetPhotoType) : "OTHER";
}

function uploadPhotoWithProgress(url: string, formData: FormData, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onerror = () => reject(new Error(uploadFailureMessage(new TypeError("Network error"))));
    request.onload = () => {
      let payload: { error?: string } = {};
      try {
        payload = JSON.parse(request.responseText || "{}") as { error?: string };
      } catch {
        payload = {};
      }
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(payload.error || uploadFailureMessage()));
    };
    request.send(formData);
  });
}
