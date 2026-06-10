"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TaskAssignButton({ taskId, label = "Assign to me" }: { taskId: string; label?: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function assignToMe() {
    setSaving(true);
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignToMe: true }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={assignToMe}
      disabled={saving}
      className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
    >
      {saving ? "Assigning..." : label}
    </button>
  );
}
