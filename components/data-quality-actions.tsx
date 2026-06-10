"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, CheckCircle2 } from "lucide-react";

type Props = {
  endpoint: string;
  label: string;
  confirmText: string;
  successText: string;
  variant?: "archive" | "apply";
};

export function DataQualityActionButton({ endpoint, label, confirmText, successText, variant = "apply" }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const Icon = variant === "archive" ? Archive : CheckCircle2;

  async function run() {
    if (!window.confirm(confirmText)) return;
    setSaving(true);
    setMessage(null);
    const response = await fetch(endpoint, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (response.ok) {
      setMessage(successText);
      router.refresh();
    } else {
      setMessage(data.error || "Action failed.");
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={run}
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        <Icon size={15} />
        {saving ? "Saving..." : label}
      </button>
      {message ? <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
