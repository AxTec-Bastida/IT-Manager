"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RunDueJobsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runDue() {
    setRunning(true);
    const response = await fetch("/api/jobs/run-due", { method: "POST" });
    const data = await response.json();
    setRunning(false);
    setMessage(response.ok ? `${data.jobsSucceeded} succeeded, ${data.jobsFailed} failed, ${data.jobsSkipped} skipped.` : data.error || "Run due failed.");
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <button onClick={runDue} disabled={running} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        <RefreshCw size={16} />
        {running ? "Running..." : "Run due jobs"}
      </button>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
