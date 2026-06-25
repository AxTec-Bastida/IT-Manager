"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, ImageUp, Loader2, ScanLine, X } from "lucide-react";
import { cameraSecurityMessage, cameraUnsupportedMessage } from "@/lib/camera";
import { valueForScanTarget, type ParsedScan } from "@/lib/scan-label";

type CameraScannerProps = {
  onDetected: (value: string, parsed: ParsedScan) => void;
  onClose?: () => void;
  title?: string;
  target?: "name" | "ipAddress" | "macAddress" | "serialNumber";
};

export function CameraScanner({ onDetected, onClose, title = "Scan label", target }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const handledRef = useRef(false);
  const lastRawRef = useRef<{ value: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const videoElement = videoRef.current;

    async function start() {
      try {
        const securityMessage = cameraSecurityMessage({ isSecureContext: window.isSecureContext, hostname: window.location.hostname });
        if (securityMessage) {
          setError(securityMessage);
          setLoading(false);
          return;
        }

        const unsupportedMessage = cameraUnsupportedMessage(Boolean(navigator.mediaDevices?.getUserMedia));
        if (unsupportedMessage) {
          setError(unsupportedMessage);
          setLoading(false);
          return;
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { parseScannedLabel } = await import("@/lib/scan-label");
        const reader = new BrowserMultiFormatReader();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const decodeCallback = (result: any) => {
          if (!active || !result || handledRef.current) return;
          const raw = result.getText();
          const now = Date.now();
          if (lastRawRef.current && lastRawRef.current.value === raw && now - lastRawRef.current.at < 4000) return;
          lastRawRef.current = { value: raw, at: now };
          handledRef.current = true;
          const parsed = parseScannedLabel(raw);
          const value = target ? valueForScanTarget(parsed, target) : parsed.query;
          setLastValue(value);

          // Stop scanner immediately on detection
          active = false;
          controlsRef.current?.stop();
          if (videoElement?.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
          }

          onDetected(value, parsed);
        };

        let controls;
        try {
          controls = await reader.decodeFromConstraints(
            {
              audio: false,
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            videoElement!,
            decodeCallback
          );
        } catch {
          // Fall back to generic video stream constraints
          controls = await reader.decodeFromConstraints(
            {
              audio: false,
              video: true,
            },
            videoElement!,
            decodeCallback
          );
        }

        controlsRef.current = controls;
        setLoading(false);
      } catch (scanError) {
        const rawMessage = scanError instanceof Error ? scanError.message : "Unable to start the camera scanner.";
        const message = /denied|permission/i.test(rawMessage)
          ? "Camera permission was denied. Allow camera access for this site in your browser settings, then try again. You can also use the photo/manual fallback below."
          : rawMessage;
        setError(message);
        setLoading(false);
      }
    }

    start();

    return () => {
      active = false;
      controlsRef.current?.stop();
      if (videoElement?.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onDetected, target]);

  async function scanImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const [{ BrowserMultiFormatReader }, { parseScannedLabel }] = await Promise.all([
        import("@zxing/browser"),
        import("@/lib/scan-label"),
      ]);
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(url);
        const parsed = parseScannedLabel(result.getText());
        const value = target ? valueForScanTarget(parsed, target) : parsed.query;
        setLastValue(value);
        onDetected(value, parsed);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("I could not read a QR/barcode from that image. Try a closer photo with the label filling the frame, or enter the value manually.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-300">Aim at QR, barcode, serial, MAC, or IP label</p>
        </div>
        <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close camera scanner">
          <X size={22} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-emerald-300 shadow-lg" />
        </div>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-sm">
            <Loader2 className="animate-spin" size={28} />
            Starting camera...
          </div>
        ) : null}
      </div>

      <div className="space-y-2 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {error ? <div className="rounded-lg bg-rose-500/20 p-3 text-sm text-rose-100">{error}</div> : null}
        <div className="flex items-center gap-2 rounded-lg bg-white/10 p-3 text-sm">
          {lastValue ? <Check className="text-emerald-300" size={18} /> : <ScanLine className="text-slate-300" size={18} />}
          <span className="min-w-0 truncate">{lastValue ? `Detected: ${lastValue}. Ready for next scan.` : "Scanning..."}</span>
        </div>
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-slate-950">
          <ImageUp size={18} />
          Scan from photo
          <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={scanImage} />
        </label>
      </div>
    </div>
  );
}

export function ScanFieldButton({
  target,
  onValue,
  label = "Scan",
}: {
  target: "name" | "ipAddress" | "macAddress" | "serialNumber";
  onValue: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        <Camera size={16} />
        {label}
      </button>
      {open ? (
        <CameraScanner
          target={target}
          title={`Scan ${target === "ipAddress" ? "IP address" : target === "macAddress" ? "MAC address" : target === "serialNumber" ? "serial number" : "device name"}`}
          onDetected={(value) => {
            onValue(value);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
