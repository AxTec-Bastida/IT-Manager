"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, ImageUp, Loader2, RotateCcw, X } from "lucide-react";
import type { AssetPhotoType } from "@prisma/client";
import { cameraPausedInBackgroundMessage, cameraSecurityMessage, cameraUnsupportedMessage, photoCompressionOptions, resizeImageFile, validateClientPhotoFile } from "@/lib/camera";

type CapturedPhoto = {
  file: File;
  previewUrl: string;
  compressed: boolean;
  source: "CAMERA" | "GALLERY";
};

type Props = {
  photoType: AssetPhotoType | string;
  onPhotoReady: (file: File, metadata?: { source: "CAMERA" | "GALLERY"; compressionApplied: boolean }) => void;
  disabled?: boolean;
  resetToken?: number;
};

export function CameraCapture({ photoType, onPhotoReady, disabled = false, resetToken = 0 }: Props) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    videoElementRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  const stopCamera = useCallback((nextMessage?: string) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoElementRef.current) videoElementRef.current.srcObject = null;
    setCameraOpen(false);
    if (nextMessage) setMessage(nextMessage);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (videoElementRef.current) videoElementRef.current.srcObject = null;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    function pauseForBackground() {
      stopCamera(cameraPausedInBackgroundMessage());
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") pauseForBackground();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", pauseForBackground);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", pauseForBackground);
    };
  }, [cameraOpen, stopCamera]);

  useEffect(() => {
    setPhoto((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      previewUrlRef.current = null;
      return null;
    });
    setMessage(null);
  }, [resetToken]);

  async function openCamera() {
    setMessage(null);
    const securityMessage = cameraSecurityMessage({ isSecureContext: window.isSecureContext, hostname: window.location.hostname });
    if (securityMessage) {
      setMessage(securityMessage);
      return;
    }
    const unsupportedMessage = cameraUnsupportedMessage(Boolean(navigator.mediaDevices?.getUserMedia));
    if (unsupportedMessage) {
      setMessage(unsupportedMessage);
      return;
    }
    setStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }
      }
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      setMessage(/denied|permission/i.test(rawMessage) ? "Camera permission was denied. Allow camera access, or choose a photo from the gallery." : "Unable to start the camera. Try the gallery upload fallback.");
    } finally {
      setStarting(false);
    }
  }

  async function takePhoto() {
    if (!videoElementRef.current) return;
    const video = videoElementRef.current;
    const options = photoCompressionOptions(photoType);
    const scale = Math.min(1, options.maxWidth / Math.max(video.videoWidth, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("Could not capture the photo. Try again or use the gallery fallback.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.mimeType, options.quality));
    if (!blob) {
      setMessage("Could not capture the photo. Try again or use the gallery fallback.");
      return;
    }
    stopCamera();
    await prepareFile(new File([blob], `asset-photo-${Date.now()}.jpg`, { type: options.mimeType, lastModified: Date.now() }), true);
  }

  async function prepareFile(file: File, fromCamera = false) {
    setWorking(true);
    setMessage(null);
    try {
      const validation = validateClientPhotoFile(file);
      if (!validation.ok) {
        setMessage(validation.message);
        return;
      }
      let selectedFile = file;
      let compressed = fromCamera;
      try {
        const resized = await resizeImageFile(file, photoType);
        compressed = compressed || resized !== file;
        selectedFile = resized;
      } catch {
        setMessage("Compression failed, so the original photo will be uploaded if it passes server validation.");
      }
      const previousUrl = previewUrlRef.current;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const previewUrl = URL.createObjectURL(selectedFile);
      previewUrlRef.current = previewUrl;
      setPhoto({ file: selectedFile, previewUrl, compressed, source: fromCamera ? "CAMERA" : "GALLERY" });
    } finally {
      setWorking(false);
    }
  }

  function usePhoto() {
    if (!photo) return;
    onPhotoReady(photo.file, { source: photo.source, compressionApplied: photo.compressed });
    setMessage(photo.compressed ? "Photo ready. It was resized before upload." : "Photo ready.");
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={openCamera}
          disabled={disabled || starting || cameraOpen}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {starting ? <Loader2 className="animate-spin" size={17} /> : <Camera size={17} />}
          {starting ? "Starting camera..." : "Take photo"}
        </button>
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100">
          <ImageUp size={17} />
          Choose from gallery
          <input
            className="sr-only"
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            disabled={disabled || working}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void prepareFile(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {cameraOpen ? (
        <div className="overflow-hidden rounded-lg bg-slate-950 text-white">
          <div className="relative aspect-[4/3]">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            <button type="button" onClick={takePhoto} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-4 font-semibold text-slate-950">
              <Camera size={17} />
              Capture
            </button>
            <button type="button" onClick={() => stopCamera()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white/10 px-4 font-semibold text-white hover:bg-white/20">
              <X size={17} />
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {photo ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Image src={photo.previewUrl} alt="Selected asset evidence preview" width={1200} height={900} className="max-h-80 w-full rounded-md bg-slate-900 object-contain" unoptimized />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={usePhoto} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800">
              <Check size={17} />
              Use photo
            </button>
            <button
              type="button"
              onClick={() => {
                if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
                previewUrlRef.current = null;
                setPhoto(null);
                setMessage(null);
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw size={17} />
              Retake / choose again
            </button>
          </div>
        </div>
      ) : null}

      {working ? <p className="text-sm text-slate-600">Preparing photo...</p> : null}
      {message ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
