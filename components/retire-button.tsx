"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive } from "lucide-react";

export function RetireButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function retire() {
    setLoading(true);
    await fetch(`/api/devices/${id}`, { method: "DELETE" });
    setLoading(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
        <p className="text-sm font-semibold text-rose-900">Retire this asset? It will remain in history.</p>
        <div className="mt-3 grid gap-2 sm:flex">
          <button
            type="button"
            onClick={retire}
            disabled={loading}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
          >
            <Archive size={16} />
            {loading ? "Retiring..." : "Confirm retire"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={loading}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
    >
      <Archive size={16} />
      {loading ? "Retiring..." : "Retire"}
    </button>
  );
}
