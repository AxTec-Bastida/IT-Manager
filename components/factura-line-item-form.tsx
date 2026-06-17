"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { DeviceCategory, FacturaLineItem } from "@prisma/client";
import { Save } from "lucide-react";
import { categoryLabels, categoryOptions } from "@/lib/constants";

type Props = {
  facturaId: string;
  lineItem?: FacturaLineItem | null;
};

export function FacturaLineItemForm({ facturaId, lineItem }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(lineItem ? `/api/facturas/${facturaId}/line-items/${lineItem.id}` : `/api/facturas/${facturaId}/line-items`, {
      method: lineItem ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save line item.");
      return;
    }
    router.push(`/facturas/${facturaId}`);
    router.refresh();
  }

  const inputClass = "min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "grid gap-1 text-sm font-semibold text-slate-700";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Line item</h2>
        <p className="mt-1 text-sm text-slate-600">Manual structure only. This does not read or parse factura PDFs.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={`${labelClass} md:col-span-2`}>
            Description
            <input className={inputClass} name="description" required defaultValue={lineItem?.description ?? ""} placeholder="10 Dell Latitude laptops" />
          </label>
          <label className={labelClass}>
            SKU
            <input className={inputClass} name="sku" defaultValue={lineItem?.sku ?? ""} />
          </label>
          <label className={labelClass}>
            Model
            <input className={inputClass} name="model" defaultValue={lineItem?.model ?? ""} />
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} name="category" defaultValue={(lineItem?.category as DeviceCategory | null) ?? ""}>
              <option value="">No category</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Quantity
            <input className={inputClass} name="quantity" type="number" min="1" required defaultValue={lineItem?.quantity ?? 1} />
          </label>
          <label className={labelClass}>
            Unit cost
            <input className={inputClass} name="unitCost" type="number" min="0" step="0.01" required defaultValue={lineItem?.unitCost ?? 0} />
          </label>
          <label className={labelClass}>
            Currency
            <input className={inputClass} name="currency" required defaultValue={lineItem?.currency ?? "MXN"} maxLength={8} />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} defaultValue={lineItem?.notes ?? ""} />
          </label>
        </div>
      </section>
      <div className="sticky bottom-20 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-0">
        <button disabled={saving} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          <Save size={16} />
          {saving ? "Saving..." : "Save line item"}
        </button>
      </div>
    </form>
  );
}
