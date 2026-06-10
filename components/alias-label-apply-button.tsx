"use client";

import { useState } from "react";

type Props = {
  deviceIds: string[];
  prefix: string;
  start: number;
  end: number;
  padding: number;
  aliasType?: string;
};

export function AliasLabelApplyButton({ deviceIds, prefix, start, end, padding, aliasType = "PHYSICAL_LABEL" }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    setMessage(null);
    const formData = new FormData();
    for (const id of deviceIds) formData.append("deviceId", id);
    formData.set("prefix", prefix);
    formData.set("start", String(start));
    formData.set("end", String(end));
    formData.set("padding", String(padding));
    formData.set("aliasType", aliasType);
    const response = await fetch("/api/labels/aliases", { method: "POST", body: formData });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.message || data.error || "Could not apply physical label aliases.");
      return;
    }
    setMessage(`Linked ${data.created} new code(s), updated ${data.updated} existing code(s).`);
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={apply}
        disabled={busy || deviceIds.length === 0}
        className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? "Applying..." : "Apply aliases to selected assets"}
      </button>
      {message ? <p className="rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}
