"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive } from "lucide-react";

export function RetireButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retire() {
    if (!confirm("Retire this device? It will remain in history.")) return;
    setLoading(true);
    await fetch(`/api/devices/${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={retire}
      disabled={loading}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
    >
      <Archive size={16} />
      {loading ? "Retiring..." : "Retire"}
    </button>
  );
}
