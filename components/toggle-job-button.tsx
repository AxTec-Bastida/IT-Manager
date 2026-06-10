"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";

export function ToggleJobButton({ jobId, enabled }: { jobId: string; enabled: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setSaving(false);
    router.refresh();
  }

  const Icon = enabled ? Pause : Play;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
    >
      <Icon size={15} />
      {saving ? "Saving..." : enabled ? "Disable" : "Enable"}
    </button>
  );
}
