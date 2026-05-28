"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AlertStatus } from "@prisma/client";

export function AlertActions({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function setStatus(status: AlertStatus) {
    setSaving(true);
    await fetch(`/api/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, resolutionNote: note }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <input value={note} onChange={(event) => setNote(event.target.value)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="Resolution note" />
      <div className="grid gap-2 sm:grid-cols-3">
        <button disabled={saving} onClick={() => setStatus("ACKNOWLEDGED")} className="min-h-12 rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Acknowledge</button>
        <button disabled={saving} onClick={() => setStatus("RESOLVED")} className="min-h-12 rounded-md bg-emerald-700 px-2 text-sm font-semibold text-white hover:bg-emerald-800">Resolve</button>
        <button disabled={saving} onClick={() => setStatus("IGNORED")} className="min-h-12 rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Ignore</button>
      </div>
    </div>
  );
}
