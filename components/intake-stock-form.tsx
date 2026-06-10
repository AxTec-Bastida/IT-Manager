"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Factura, StockItem } from "@prisma/client";
import { PackageCheck } from "lucide-react";
import { stockCategoryLabels, stockCategoryOptions, stockItemTypeLabels, stockItemTypeOptions } from "@/lib/constants";

type Props = {
  stockItems: Array<Pick<StockItem, "id" | "name" | "sku" | "barcodeValue" | "quantityOnHand">>;
  facturas: Factura[];
};

export function IntakeStockForm({ stockItems, facturas }: Props) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; openStock: string; issue: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const payload = { ...Object.fromEntries(new FormData(event.currentTarget).entries()), mode };
      const response = await fetch("/api/intake/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to receive stock.");
      setResult({ name: data.stockItem.name, openStock: data.links.openStock, issue: data.links.issue });
      event.currentTarget.reset();
      setMode("new");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to receive stock.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "grid gap-1 text-sm font-semibold text-slate-700";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">What arrived?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setMode("new")} aria-pressed={mode === "new"} className={`min-h-14 rounded-md border px-4 text-sm font-semibold ${mode === "new" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            Add new stock item
          </button>
          <button type="button" onClick={() => setMode("existing")} aria-pressed={mode === "existing"} className={`min-h-14 rounded-md border px-4 text-sm font-semibold ${mode === "existing" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            Add quantity to existing
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {mode === "existing" ? (
            <label className={`${labelClass} md:col-span-2`}>
              Existing stock item
              <select className={inputClass} name="stockItemId" defaultValue="">
                <option value="">Select stock item</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} / {item.sku || item.barcodeValue || "no SKU"} / on hand {item.quantityOnHand}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className={labelClass}>
                Item name
                <input className={inputClass} name="itemName" placeholder="USB-C charger, Zebra labels, Mouse M170" />
              </label>
              <label className={labelClass}>
                SKU
                <input className={inputClass} name="sku" placeholder="Optional SKU" />
              </label>
              <label className={labelClass}>
                Scan code
                <input className={inputClass} name="barcodeValue" placeholder="STOCK:USB-C-CHARGER" />
              </label>
              <label className={labelClass}>
                Category
                <select className={inputClass} name="category" defaultValue="ACCESSORY">
                  {stockCategoryOptions.map((category) => <option key={category} value={category}>{stockCategoryLabels[category]}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Type
                <select className={inputClass} name="itemType" defaultValue="PERIPHERAL">
                  {stockItemTypeOptions.map((type) => <option key={type} value={type}>{stockItemTypeLabels[type]}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Minimum stock threshold
                <input className={inputClass} name="minimumQuantity" type="number" min="0" defaultValue="0" />
              </label>
            </>
          )}

          <label className={labelClass}>
            Quantity received
            <input className={inputClass} name="receivedQuantity" type="number" min="1" required defaultValue="1" />
          </label>
          <label className={labelClass}>
            Unit
            <input className={inputClass} name="unit" placeholder="each, roll, box" />
          </label>
          <label className={labelClass}>
            Storage location
            <input className={inputClass} name="storageLocation" placeholder="IT cage shelf B2" />
          </label>
          <label className={labelClass}>
            Condition
            <input className={inputClass} name="condition" placeholder="New, good, packaging damaged" />
          </label>
          <label className={labelClass}>
            Vendor
            <input className={inputClass} name="vendorName" placeholder="Optional vendor" />
          </label>
          <label className={labelClass}>
            Factura
            <select className={inputClass} name="facturaId" defaultValue="">
              <option value="">No factura link</option>
              {facturas.map((factura) => <option key={factura.id} value={factura.id}>{factura.facturaNumber} - {factura.vendorName}</option>)}
            </select>
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={3} placeholder="Receiving notes, packaging, PO context" />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-950">Stock photo note</p>
        <p className="mt-1">Optional stock photos can be added from the stock item detail page after receiving inventory. Photos are visual references only and do not change quantity or movement history.</p>
      </section>

      <div className="sticky bottom-20 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-0">
        <button disabled={saving} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          <PackageCheck size={18} />
          {saving ? "Receiving..." : "Receive stock"}
        </button>
      </div>

      {result ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold text-emerald-950">Received {result.name}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Link href={result.openStock} className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white">Open stock item</Link>
            <Link href={result.issue} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">Issue / loan item</Link>
            <button type="button" onClick={() => setResult(null)} className="inline-flex min-h-12 items-center justify-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800">Add another</button>
          </div>
        </section>
      ) : null}
    </form>
  );
}
