"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RmaRefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    await fetch("/api/rma/reminders", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button type="button" onClick={refresh} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">
      <RefreshCw size={15} />
      {loading ? "Refreshing..." : "Refresh RMA reminders"}
    </button>
  );
}
