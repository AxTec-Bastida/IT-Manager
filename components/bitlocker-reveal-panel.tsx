"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";

export function BitLockerRevealPanel({ deviceId }: { deviceId: string }) {
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!revealedKey) return;
    const timer = window.setTimeout(() => setRevealedKey(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [revealedKey]);

  async function reveal() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/devices/${deviceId}/bitlocker/reveal`, { method: "POST", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Could not reveal BitLocker recovery key.");
      return;
    }
    setRevealedKey(data.recoveryKey);
    setMessage("Recovery key revealed for 60 seconds. Treat it as sensitive.");
  }

  async function copyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    await fetch(`/api/devices/${deviceId}/bitlocker/copy-log`, { method: "POST" }).catch(() => undefined);
    setMessage("Recovery key copied. Copy action was logged.");
  }

  return (
    <div className="space-y-3">
      {message ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}
      {revealedKey ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase text-amber-700">Recovery key</p>
          <p className="mt-2 break-all font-mono text-lg font-semibold text-amber-950">{revealedKey}</p>
          <div className="mt-3 grid gap-2 sm:flex">
            <button type="button" onClick={copyKey} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Copy size={16} />
              Copy key
            </button>
            <button type="button" onClick={() => setRevealedKey(null)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <EyeOff size={16} />
              Hide key
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={reveal} disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60 sm:w-auto">
          <Eye size={16} />
          {loading ? "Revealing..." : "Reveal recovery key"}
        </button>
      )}
    </div>
  );
}
