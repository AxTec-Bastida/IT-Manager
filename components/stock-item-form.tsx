"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeviceCategory, Factura, StockItem } from "@prisma/client";
import { Save } from "lucide-react";
import { categoryLabels, categoryOptions, stockCategoryLabels, stockCategoryOptions, stockItemTypeLabels, stockItemTypeOptions } from "@/lib/constants";

type Props = {
  stockItem?: StockItem | null;
  defaults?: { currency?: string; minimumQuantity?: number };
  facturas?: Factura[];
};

export function StockItemForm({ stockItem, defaults, facturas = [] }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md sm:min-h-12 border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = { ...Object.fromEntries(formData.entries()), active: formData.get("active") === "on" };
    const response = await fetch(stockItem ? `/api/stock/${stockItem.id}` : "/api/stock", {
      method: stockItem ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to save stock item.");
      return;
    }
    router.push(`/stock/${data.stockItem.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Basic info</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Item name
            <input className={inputClass} name="name" defaultValue={stockItem?.name ?? ""} required placeholder="Zebra ZT411 printhead" />
          </label>
          <label className={labelClass}>
            SKU / barcode
            <input className={inputClass} name="sku" defaultValue={stockItem?.sku ?? ""} placeholder="SKU or scanned label value" />
          </label>
          <label className={labelClass}>
            Scan code
            <input className={inputClass} name="barcodeValue" defaultValue={stockItem?.barcodeValue ?? ""} placeholder="KEYBOARD, STOCK:KEYBOARD, MOUSE" />
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} name="category" defaultValue={stockItem?.category ?? "OTHER"}>
              {stockCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {stockCategoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Item type
            <select className={inputClass} name="itemType" defaultValue={stockItem?.itemType ?? "CONSUMABLE"}>
              {stockItemTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {stockItemTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Quantity / thresholds</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Quantity on hand
            <input className={inputClass} name="quantityOnHand" type="number" min="0" defaultValue={stockItem?.quantityOnHand ?? 0} />
          </label>
          <label className={labelClass}>
            Minimum quantity
            <input className={inputClass} name="minimumQuantity" type="number" min="0" defaultValue={stockItem?.minimumQuantity ?? defaults?.minimumQuantity ?? 0} />
          </label>
          <label className={labelClass}>
            Reorder quantity
            <input className={inputClass} name="reorderQuantity" type="number" min="0" defaultValue={stockItem?.reorderQuantity ?? ""} />
          </label>
          <label className={labelClass}>
            Unit cost
            <input className={inputClass} name="unitCost" type="number" min="0" step="0.01" defaultValue={stockItem?.unitCost ?? ""} />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Storage / vendor</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Currency
            <input className={inputClass} name="currency" defaultValue={stockItem?.currency ?? defaults?.currency ?? "USD"} />
          </label>
          <label className={labelClass}>
            Vendor
            <input className={inputClass} name="vendorName" defaultValue={stockItem?.vendorName ?? ""} />
          </label>
          <label className={labelClass}>
            Linked factura
            <select className={inputClass} name="facturaId" defaultValue={stockItem?.facturaId ?? ""}>
              <option value="">No linked factura</option>
              {facturas.map((factura) => (
                <option key={factura.id} value={factura.id}>
                  {factura.facturaNumber} - {factura.vendorName}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Storage location
            <input className={inputClass} name="storageLocation" defaultValue={stockItem?.storageLocation ?? ""} placeholder="IT cage shelf B2" />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Compatibility / notes</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Compatible asset category
            <select className={inputClass} name="compatibleAssetCategory" defaultValue={(stockItem?.compatibleAssetCategory as DeviceCategory | null) ?? ""}>
              <option value="">Any / not specific</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-2 text-sm font-medium text-slate-700">
            <input className="size-4 rounded border-slate-300" name="active" type="checkbox" defaultChecked={stockItem?.active ?? true} />
            Active item
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Compatible models
            <input className={inputClass} name="compatibleModels" defaultValue={stockItem?.compatibleModels ?? ""} placeholder="ZT410, ZT411, GK420d" />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} defaultValue={stockItem?.notes ?? ""} />
          </label>
        </div>
      </fieldset>

      <div>
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save stock item"}
        </button>
      </div>
    </form>
  );
}
