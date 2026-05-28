"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshAlertsButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function refresh() {
    setRunning(true);
    const response = await fetch("/api/alerts/refresh", { method: "POST" });
    const data = await response.json();
    setRunning(false);
    setMessage(response.ok ? `${data.alertsCreated} created, ${data.alertsUpdated} updated, ${data.alertsResolved} resolved.` : data.error || "Refresh failed.");
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <button onClick={refresh} disabled={running} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        <RefreshCw size={16} />
        {running ? "Refreshing..." : "Refresh alerts"}
      </button>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
