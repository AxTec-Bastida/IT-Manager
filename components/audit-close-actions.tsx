"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AuditCloseActions({ auditId, unresolvedCount }: { auditId: string; unresolvedCount: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function close(status: "CLOSED" | "REVIEW") {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/audits/${auditId}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not close audit.");
        return;
      }
      router.push(`/audits/${auditId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{error}</div> : null}
      {unresolvedCount ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          This audit still has {unresolvedCount} unresolved finding{unresolvedCount === 1 ? "" : "s"}. You can close with warning or keep it in review.
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={isPending} onClick={() => close("REVIEW")} className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">
          Keep in review
        </button>
        <button type="button" disabled={isPending} onClick={() => close("CLOSED")} className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">
          Close audit
        </button>
      </div>
    </div>
  );
}
