"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { StockItemPhoto, StockItemPhotoType } from "@prisma/client";
import { Camera, Upload } from "lucide-react";
import { CameraCapture } from "@/components/camera-capture";
import { uploadFailureMessage } from "@/lib/camera";
import { stockItemPhotoTypeLabels, stockItemPhotoTypeOptions } from "@/lib/constants";

type Props = {
  stockItemId: string;
  photos: StockItemPhoto[];
};

export function StockItemPhotoPanel({ stockItemId, photos }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState<StockItemPhotoType>("OVERVIEW");
  const [caption, setCaption] = useState("");
  const [photoMetadata, setPhotoMetadata] = useState<{ source: "CAMERA" | "GALLERY" | "UNKNOWN"; compressionApplied: boolean }>({ source: "UNKNOWN", compressionApplied: false });
  const [resetToken, setResetToken] = useState(0);
  const inputClass = "w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setMessage("Take a stock photo or choose one from the gallery first.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("photoType", selectedPhotoType);
    formData.set("caption", caption);
    formData.set("source", photoMetadata.source);
    formData.set("compressionApplied", String(photoMetadata.compressionApplied));
    try {
      const response = await fetch(`/api/stock/${stockItemId}/photos`, { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not upload stock photo.");
      setMessage("Stock photo uploaded.");
      setSelectedFile(null);
      setCaption("");
      setPhotoMetadata({ source: "UNKNOWN", compressionApplied: false });
      setResetToken((value) => value + 1);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : uploadFailureMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="font-semibold text-slate-950">Stock Photos</h2>
        <p className="mt-1 text-sm text-slate-500">Optional visual reference for packaging, SKU labels, and storage location. Quantity and movement history are not changed.</p>
      </div>

      <form onSubmit={uploadPhoto} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-2">
        {message ? <div className="rounded-md bg-white p-3 text-sm text-slate-700 lg:col-span-2">{message}</div> : null}
        <div className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Take or upload stock photo
          <CameraCapture
            photoType={selectedPhotoType}
            disabled={saving}
            resetToken={resetToken}
            onPhotoReady={(file, metadata) => {
              setSelectedFile(file);
              setPhotoMetadata({ source: metadata?.source ?? "UNKNOWN", compressionApplied: Boolean(metadata?.compressionApplied) });
              setMessage(`Photo ready: ${file.name} (${Math.ceil(file.size / 1024)} KB).`);
            }}
          />
        </div>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Photo type
          <select className={inputClass} name="photoType" value={selectedPhotoType} onChange={(event) => setSelectedPhotoType(event.target.value as StockItemPhotoType)}>
            {stockItemPhotoTypeOptions.map((type) => (
              <option key={type} value={type}>
                {stockItemPhotoTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
          Caption
          <input className={inputClass} name="caption" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Example: box label, storage bin, front of package" />
        </label>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={saving}>
          <Upload size={17} />
          {saving ? "Uploading..." : "Upload stock photo"}
        </button>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <a href={photo.filePath} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-slate-100">
              <Image src={photo.thumbnailPath || photo.filePath} alt={photo.caption || stockItemPhotoTypeLabels[photo.photoType]} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized loading="lazy" />
            </a>
            <div className="p-3 text-sm">
              <p className="font-semibold text-slate-950">{stockItemPhotoTypeLabels[photo.photoType]}</p>
              <p className="mt-1 text-slate-500">{photo.caption || "No caption"}</p>
              <p className="mt-1 text-xs text-slate-500">{photo.thumbnailPath ? "Thumbnail ready" : "No thumbnail yet"} / {Math.ceil(photo.sizeBytes / 1024)} KB</p>
            </div>
          </article>
        ))}
      </div>
      {photos.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          <Camera className="mx-auto mb-2 text-slate-400" size={24} />
          No stock photos yet. Add packaging, SKU label, or storage-location photos when useful.
        </div>
      ) : null}
    </section>
  );
}
