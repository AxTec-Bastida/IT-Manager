"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

export function RunJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runNow() {
    setRunning(true);
    const response = await fetch(`/api/jobs/${jobId}/run-now`, { method: "POST" });
    const data = await response.json();
    setRunning(false);
    setMessage(response.ok ? `${data.status}${data.errorMessage ? `: ${data.errorMessage}` : ""}` : data.error || "Run failed.");
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      <button onClick={runNow} disabled={running} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        <Play size={15} />
        {running ? "Running..." : "Run now"}
      </button>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
