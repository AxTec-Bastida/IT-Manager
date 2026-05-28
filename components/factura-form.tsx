"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Device, Factura, StockItem } from "@prisma/client";
import { Save } from "lucide-react";

type Props = {
  factura?: (Factura & { assets?: Device[]; stockItems?: StockItem[] }) | null;
  assets: Device[];
  stockItems: StockItem[];
};

export function FacturaForm({ factura, assets, stockItems }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedAssets = new Set(factura?.assets?.map((asset) => asset.id) ?? []);
  const selectedStockItems = new Set(factura?.stockItems?.map((item) => item.id) ?? []);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const response = await fetch(factura ? `/api/facturas/${factura.id}` : "/api/facturas", {
      method: factura ? "PATCH" : "POST",
      body: formData,
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save factura.");
      return;
    }
    router.push(`/facturas/${data.factura.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Purchase record</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Factura number
            <input className={inputClass} name="facturaNumber" defaultValue={factura?.facturaNumber ?? ""} required />
          </label>
          <label className={labelClass}>
            Vendor
            <input className={inputClass} name="vendorName" defaultValue={factura?.vendorName ?? ""} required />
          </label>
          <label className={labelClass}>
            Vendor RFC
            <input className={inputClass} name="vendorRfc" defaultValue={factura?.vendorRfc ?? ""} />
          </label>
          <label className={labelClass}>
            PO number
            <input className={inputClass} name="poNumber" defaultValue={factura?.poNumber ?? ""} />
          </label>
          <label className={labelClass}>
            Purchase date
            <input className={inputClass} name="purchaseDate" type="date" defaultValue={factura?.purchaseDate ? factura.purchaseDate.toISOString().slice(0, 10) : ""} />
          </label>
          <label className={labelClass}>
            Received date
            <input className={inputClass} name="receivedDate" type="date" defaultValue={factura?.receivedDate ? factura.receivedDate.toISOString().slice(0, 10) : ""} />
          </label>
          <label className={labelClass}>
            Total amount
            <input className={inputClass} name="totalAmount" type="number" min="0" step="0.01" defaultValue={factura?.totalAmount ?? ""} />
          </label>
          <label className={labelClass}>
            Currency
            <input className={inputClass} name="currency" defaultValue={factura?.currency ?? "USD"} />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Warranty / file</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Warranty start
            <input className={inputClass} name="warrantyStartAt" type="date" defaultValue={factura?.warrantyStartAt ? factura.warrantyStartAt.toISOString().slice(0, 10) : ""} />
          </label>
          <label className={labelClass}>
            Warranty end
            <input className={inputClass} name="warrantyEndAt" type="date" defaultValue={factura?.warrantyEndAt ? factura.warrantyEndAt.toISOString().slice(0, 10) : ""} />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Attach factura PDF/photo
            <input className={inputClass} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" capture="environment" />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Linked assets / stock</legend>
        <div className="grid gap-4">
          <label className={labelClass}>
            Link assets
            <select className={`${inputClass} min-h-40`} name="assetIds" multiple defaultValue={[...selectedAssets]}>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetTag ? `${asset.assetTag} - ` : ""}{asset.name}{asset.serialNumber ? ` (${asset.serialNumber})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Link stock items
            <select className={`${inputClass} min-h-40`} name="stockItemIds" multiple defaultValue={[...selectedStockItems]}>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku ? `${item.sku} - ` : ""}{item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} defaultValue={factura?.notes ?? ""} />
          </label>
        </div>
      </fieldset>

      <div>
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save factura"}
        </button>
      </div>
    </form>
  );
}
