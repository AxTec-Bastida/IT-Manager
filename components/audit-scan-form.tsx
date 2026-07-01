"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { CameraScanner } from "@/components/camera-scanner";

type Progress = {
  expected: number;
  found: number;
  remaining: number;
  missing: number;
  wrongArea: number;
  unknown: number;
  duplicates: number;
  needsReview: number;
};

type ScanResult = {
  resultType: string;
  message: string;
  matchedDevice?: { id: string; name: string; assetTag?: string | null; location?: string | null; areaDepartment?: string | null } | null;
};

export function AuditScanForm({ auditId, initialProgress }: { auditId: string; initialProgress: Progress }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [progress, setProgress] = useState(initialProgress);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, [lastResult]);

  async function handleScan(scannedValue: string) {
    if (!scannedValue) return;
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/audits/${auditId}/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scannedValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not record scan.");
        return;
      }
      setValue("");
      setProgress(data.progress);
      setLastResult({
        resultType: data.scan.resultType,
        message: data.classification.message,
        matchedDevice: data.scan.matchedDevice,
      });
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await handleScan(value.trim());
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Found" value={`${progress.found}/${progress.expected}`} />
        <Metric label="Remaining" value={progress.remaining} />
        <Metric label="Wrong area" value={progress.wrongArea} />
        <Metric label="Unknown" value={progress.unknown} />
        <Metric label="Duplicate" value={progress.duplicates} />
        <Metric label="Needs review" value={progress.needsReview} />
      </div>

      <form onSubmit={submit} className="sticky top-[73px] z-20 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{error}</div> : null}
        <div className="grid gap-2 text-sm font-semibold text-slate-700">
          <label htmlFor="audit-asset-scan">Scan asset label</label>
          <div className="relative">
            <input
              id="audit-asset-scan"
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Scan or type asset tag / alias / serial"
              className="w-full min-h-16 rounded-md border border-slate-300 pl-4 pr-16 text-lg font-semibold"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
              title="Scan with camera"
            >
              <Camera size={20} />
            </button>
          </div>
        </div>
        <button disabled={isPending} className="min-h-14 w-full rounded-md bg-slate-950 px-4 text-base font-semibold text-white disabled:opacity-60">
          Record scan
        </button>
      </form>

      {scannerOpen ? (
        <CameraScanner
          title="Scan asset tag / barcode"
          onDetected={async (detectedValue) => {
            setValue(detectedValue);
            setScannerOpen(false);
            await handleScan(detectedValue);
          }}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

      {lastResult ? <ResultCard auditId={auditId} result={lastResult} /> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ResultCard({ auditId, result }: { auditId: string; result: ScanResult }) {
  const tone =
    result.resultType === "FOUND_EXPECTED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : result.resultType === "UNKNOWN_LABEL" || result.resultType === "NEEDS_REVIEW"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-white text-slate-950";
  return (
    <article className={`rounded-lg border p-4 shadow-sm ${tone}`}>
      <p className="text-xs font-semibold uppercase">{result.resultType.replaceAll("_", " ")}</p>
      <h2 className="mt-1 text-lg font-semibold">{result.message}</h2>
      {result.matchedDevice ? (
        <div className="mt-2 text-sm">
          <p className="font-semibold">{result.matchedDevice.name}</p>
          <p className="font-mono">{result.matchedDevice.assetTag || "No tag"}</p>
          <p>{result.matchedDevice.location || result.matchedDevice.areaDepartment || "No location"}</p>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {result.matchedDevice ? (
          <>
            <Link href={`/devices/${result.matchedDevice.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
              Open asset
            </Link>
            {result.resultType === "FOUND_WRONG_AREA" || result.resultType === "FOUND_NOT_EXPECTED" ? (
              <Link href={`/devices/${result.matchedDevice.id}/move?fromAuditId=${auditId}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
                Move here
              </Link>
            ) : null}
            <Link href={`/tasks/new?title=${encodeURIComponent(`Audit review: ${result.matchedDevice.assetTag || result.matchedDevice.name}`)}&category=INVENTORY&relatedDeviceId=${result.matchedDevice.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
              Create task
            </Link>
          </>
        ) : (
          <Link href={`/tasks/new?title=${encodeURIComponent("Audit unknown label")}&category=INVENTORY`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            Create task
          </Link>
        )}
      </div>
    </article>
  );
}
