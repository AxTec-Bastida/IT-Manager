"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkspaceStatusButton({
  endpoint,
  status,
  children,
  variant = "secondary",
}: {
  endpoint: string;
  status: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function updateStatus() {
    setSaving(true);
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={updateStatus}
      disabled={saving}
      className={variant === "primary"
        ? "inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        : "inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"}
    >
      {saving ? "Saving..." : children}
    </button>
  );
}
