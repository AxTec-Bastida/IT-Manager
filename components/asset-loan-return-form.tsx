"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetLoan, AssetLoanItem, Device } from "@prisma/client";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/badge";
import { assetLoanReturnConditionLabels, assetLoanReturnConditionOptions, categoryLabels } from "@/lib/constants";

type LoanWithItems = AssetLoan & { items: Array<AssetLoanItem & { device: Pick<Device, "id" | "name" | "assetTag" | "serialNumber" | "model" | "category"> }> };

export function AssetLoanReturnForm({ loan }: { loan: LoanWithItems }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(loan.items.filter((item) => item.returnStatus === "PENDING").map((item) => item.id)));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingItems = loan.items.filter((item) => item.returnStatus === "PENDING");
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";

  function toggle(itemId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const items = pendingItems.map((item) => ({
      selected: selected.has(item.id),
      itemId: item.id,
      conditionIn: formData.get(`conditionIn-${item.id}`),
      accessoriesReturned: formData.get(`accessoriesReturned-${item.id}`),
      returnNotes: formData.get(`returnNotes-${item.id}`),
      returnedAt: formData.get(`returnedAt-${item.id}`),
    }));
    const response = await fetch(`/api/loans/${loan.id}/return`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, returnNotes: formData.get("returnNotes") }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to return loaned assets.");
      return;
    }
    router.push(`/loans/${data.loan.id}`);
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-4">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}
      {pendingItems.map((item) => (
        <section key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" className="mt-1 size-5" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
            <span className="min-w-0">
              <span className="font-semibold text-slate-950">{item.device.name}</span>
              <span className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
                <span>{item.device.assetTag || "No tag"}</span>
                <span>{item.device.serialNumber || "No serial"}</span>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[item.device.category]}</Badge>
              </span>
            </span>
          </label>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Return condition
              <select className={inputClass} name={`conditionIn-${item.id}`} defaultValue="GOOD">
                {assetLoanReturnConditionOptions.map((condition) => <option key={condition} value={condition}>{assetLoanReturnConditionLabels[condition]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Returned date
              <input className={inputClass} name={`returnedAt-${item.id}`} type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Accessories returned
              <input className={inputClass} name={`accessoriesReturned-${item.id}`} placeholder="Charger, case, dock..." />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Item notes
              <input className={inputClass} name={`returnNotes-${item.id}`} />
            </label>
          </div>
        </section>
      ))}
      <label className="block space-y-1 text-sm font-medium text-slate-700">
        Return notes
        <textarea className={inputClass} name="returnNotes" rows={3} />
      </label>
      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto" disabled={saving || selected.size === 0}>
        <RotateCcw size={18} />
        {saving ? "Saving..." : "Confirm Return"}
      </button>
    </form>
  );
}
