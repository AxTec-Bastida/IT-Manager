"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  facturaId: string;
  status: "ACTIVE" | "ARCHIVED" | "VOID" | "INVALID";
  canManage: boolean;
  canHardDelete: boolean;
  blockers: string[];
};

export function FacturaLifecycleActions({ facturaId, status, canManage, canHardDelete, blockers }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function postAction(action: "ARCHIVE" | "VOID" | "INVALID" | "RESTORE" | "DELETE") {
    if (action === "DELETE" && !window.confirm("Hard delete this factura? This is permanent and only allowed when no records or files depend on it.")) return;
    setSaving(action);
    setMessage(null);
    const response = await fetch(`/api/facturas/${facturaId}/lifecycle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(null);
    if (!response.ok) {
      setMessage(data.error || "Could not update factura.");
      return;
    }
    if (action === "DELETE") {
      router.push("/facturas");
      router.refresh();
      return;
    }
    setMessage(data.message || "Factura updated.");
    router.refresh();
  }

  if (!canManage) {
    return <p className="text-sm text-slate-500">Admin access is required to archive, void, restore, or hard-delete facturas.</p>;
  }

  return (
    <div className="space-y-3">
      {message ? <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">{message}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {status === "ACTIVE" ? (
          <>
            <button type="button" disabled={Boolean(saving)} onClick={() => postAction("ARCHIVE")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Archive</button>
            <button type="button" disabled={Boolean(saving)} onClick={() => postAction("VOID")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-rose-300 bg-rose-50 px-3 text-sm font-semibold text-rose-800 hover:bg-rose-100">Mark void</button>
          </>
        ) : (
          <button type="button" disabled={Boolean(saving)} onClick={() => postAction("RESTORE")} className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 sm:col-span-2">Restore to active</button>
        )}
        <button type="button" disabled={Boolean(saving) || !canHardDelete} onClick={() => postAction("DELETE")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">Hard delete if safe</button>
      </div>
      {!canHardDelete ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Hard delete is blocked because this factura still has dependencies.</p>
          <p className="mt-1">{blockers.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}
