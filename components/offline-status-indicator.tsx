"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import { getOfflineQueueSnapshot } from "@/lib/offline-queue";

export function OfflineStatusIndicator({ compact = false }: { compact?: boolean }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [conflict, setConflict] = useState(0);

  useEffect(() => {
    function refresh() {
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
      const snapshot = getOfflineQueueSnapshot();
      setPending(snapshot.pendingCount + snapshot.syncingCount);
      setFailed(snapshot.failedCount);
      setConflict(snapshot.conflictCount);
    }
    const timeout = window.setTimeout(refresh, 0);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("offline-queue-changed", refresh);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("offline-queue-changed", refresh);
    };
  }, []);

  const needsSync = pending > 0 || failed > 0 || conflict > 0;
  const label = !online ? "Offline - actions will queue" : needsSync ? "Sync needed" : "Online";
  const Icon = !online ? CloudOff : needsSync ? RotateCcw : Cloud;

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
        !online ? "border-amber-200 bg-amber-50 text-amber-800" : needsSync ? "border-sky-200 bg-sky-50 text-sky-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
        compact && "px-2 py-1",
      )}
    >
      <Icon size={compact ? 14 : 16} />
      <span>{label}</span>
      {needsSync ? <span className="rounded-full bg-white/80 px-2 py-0.5">{pending + failed + conflict}</span> : null}
    </div>
  );
}
