"use client";

import { useState } from "react";
import { Lightbulb, Plus } from "lucide-react";

export function SuggestIpButton({ rangeId }: { rangeId: string }) {
  const [state, setState] = useState<{ ip?: string | null; reason?: string; error?: string; reservedId?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function suggest(reserve = false) {
    setLoading(true);
    const response = await fetch(`/api/ranges/${rangeId}/suggest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reserve }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setState({ error: data.error || "Unable to suggest an IP." });
      return;
    }
    setState({
      ip: data.suggestion.ip,
      reason: data.suggestion.reason,
      reservedId: data.reservation?.id,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => suggest(false)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto"
          disabled={loading}
        >
          <Lightbulb size={16} />
          {loading ? "Checking..." : "Suggest next available IP"}
        </button>
        {state?.ip ? (
          <button
            type="button"
            onClick={() => suggest(true)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto"
          >
            <Plus size={16} />
            Reserve {state.ip}
          </button>
        ) : null}
      </div>
      {state?.error ? <p className="text-sm text-rose-700">{state.error}</p> : null}
      {state?.reason ? (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          {state.ip ? <strong className="text-slate-950">{state.ip}: </strong> : null}
          {state.reason}
          {state.reservedId ? " Reservation created." : ""}
        </p>
      ) : null}
    </div>
  );
}
