"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Device, StockItem } from "@prisma/client";
import { Save } from "lucide-react";
import { maintenanceTypeLabels, maintenanceTypeOptions } from "@/lib/constants";

type Props = {
  asset: Device;
  stockItems: StockItem[];
};

export function MaintenanceForm({ asset, stockItems }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md sm:min-h-12 border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = { ...Object.fromEntries(formData.entries()), assetId: asset.id };
    const response = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save maintenance record.");
      return;
    }
    router.push(`/devices/${asset.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Maintenance type</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Asset
            <input className={inputClass} value={`${asset.name}${asset.assetTag ? ` (${asset.assetTag})` : ""}`} disabled />
          </label>
          <label className={labelClass}>
            Maintenance type
            <select className={inputClass} name="maintenanceType" defaultValue={asset.category === "THERMAL_PRINTER" ? "CLEANING" : "INSPECTION"}>
              {maintenanceTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {maintenanceTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Performed at
            <input className={inputClass} name="performedAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
          </label>
          <label className={labelClass}>
            Performed by
            <input className={inputClass} name="performedBy" placeholder="Technician name" />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Parts / stock used</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Use stock item / part
            <select className={inputClass} name="stockItemId" defaultValue="">
              <option value="">No stock item used</option>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.sku ? `(${item.sku})` : ""} - {item.quantityOnHand} on hand
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Quantity used
            <input className={inputClass} name="quantityUsed" type="number" min="1" placeholder="Only if using stock" />
          </label>
          <label className={labelClass}>
            Part serial number
            <input className={inputClass} name="partSerialNumber" />
          </label>
          <label className={labelClass}>
            Cost
            <input className={inputClass} name="cost" type="number" min="0" step="0.01" />
          </label>
          <label className={labelClass}>
            Currency
            <input className={inputClass} name="currency" defaultValue="USD" />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Notes / next due</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Next due
            <input className={inputClass} name="nextDueAt" type="datetime-local" />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Previous part info
            <input className={inputClass} name="previousPartInfo" />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            New part info
            <input className={inputClass} name="newPartInfo" />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} />
          </label>
        </div>
      </fieldset>

      <div>
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save maintenance"}
        </button>
      </div>
    </form>
  );
}
