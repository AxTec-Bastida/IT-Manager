"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function DetectConflictsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function detect() {
    setLoading(true);
    await fetch("/api/conflicts/detect", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={detect}
      disabled={loading}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
    >
      <RefreshCw size={16} />
      {loading ? "Checking..." : "Run conflict detection"}
    </button>
  );
}
