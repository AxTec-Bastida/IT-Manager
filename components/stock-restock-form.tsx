"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Factura, StockItem } from "@prisma/client";
import { CheckCircle, PackagePlus, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";

type Props = {
  stockItems: StockItem[];
  facturas: Factura[];
  initialStockItemId?: string;
};

export function StockRestockForm({ stockItems, facturas, initialStockItemId = "" }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialStockItemId);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [facturaId, setFacturaId] = useState<string>("");
  const [storageLocation, setStorageLocation] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ id: string; name: string; added: number; total: number } | null>(null);

  const selectedItem = stockItems.find((item) => item.id === selectedId) ?? null;
  const currentQuantity = selectedItem ? selectedItem.quantityOnHand : 0;
  const newQuantityPreview = currentQuantity + (Number(quantity) || 0);

  // Sync default values when item is selected
  const handleItemChange = (itemId: string) => {
    setSelectedId(itemId);
    const item = stockItems.find((i) => i.id === itemId);
    if (item) {
      setUnitCost(item.unitCost?.toString() ?? "");
      setVendorName(item.vendorName ?? "");
      setStorageLocation(item.storageLocation ?? "");
      setFacturaId(item.facturaId ?? "");
    } else {
      setUnitCost("");
      setVendorName("");
      setStorageLocation("");
      setFacturaId("");
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      setError("Please select a stock item.");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity to add must be greater than zero.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/stock/${selectedId}/movement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          movementType: "RESTOCK",
          quantity,
          reason: "Restocked existing item",
          notes: notes || "Restocked through restock portal",
          facturaId: facturaId || undefined,
          performedBy: "IT Staff",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save restock movement.");
      }

      // Also update stock item details if unit cost / vendor / storage location changed
      if (
        unitCost !== (selectedItem?.unitCost?.toString() ?? "") ||
        vendorName !== (selectedItem?.vendorName ?? "") ||
        storageLocation !== (selectedItem?.storageLocation ?? "") ||
        facturaId !== (selectedItem?.facturaId ?? "")
      ) {
        await fetch(`/api/stock/${selectedId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: selectedItem?.name,
            category: selectedItem?.category,
            itemType: selectedItem?.itemType,
            quantityOnHand: newQuantityPreview, // Matches new quantity
            minimumQuantity: selectedItem?.minimumQuantity,
            reorderQuantity: selectedItem?.reorderQuantity,
            unitCost: unitCost ? parseFloat(unitCost) : null,
            currency: selectedItem?.currency || "USD",
            vendorName: vendorName || null,
            storageLocation: storageLocation || null,
            facturaId: facturaId || null,
            active: true,
          }),
        });
      }

      setSuccessResult({
        id: selectedId,
        name: selectedItem?.name ?? "Item",
        added: quantity,
        total: newQuantityPreview,
      });
      
      // Reset input fields
      setQuantity(1);
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  if (successResult) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-950 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="text-emerald-600 size-6 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-emerald-900">Restock Successful!</h3>
            <p className="text-emerald-700">Added {successResult.added} units to <strong>{successResult.name}</strong>.</p>
          </div>
        </div>
        <div className="rounded-md bg-white border border-emerald-100 p-4">
          <p className="font-semibold text-slate-900">New On-Hand Total: {successResult.total}</p>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href={`/stock/${successResult.id}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800"
          >
            Open stock item
          </Link>
          <a
            href={`/labels?mode=stock&stockItemId=${successResult.id}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Printer size={15} />
            Print label
          </a>
          <button
            onClick={() => setSuccessResult(null)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-4 font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <RefreshCw size={15} />
            Restock another
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Select Stock Item</legend>
        
        <label className={labelClass}>
          Stock Item
          <select 
            className={inputClass} 
            value={selectedId} 
            onChange={(e) => handleItemChange(e.target.value)}
            required
          >
            <option value="">-- Choose item to restock --</option>
            {stockItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} {item.barcodeValue ? `(${item.barcodeValue})` : ""} - Current Qty: {item.quantityOnHand}
              </option>
            ))}
          </select>
        </label>

        {selectedItem && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-md bg-slate-50 p-3.5 border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Barcode / Stock Code</span>
              <p className="text-sm font-mono font-bold text-slate-950">{selectedItem.barcodeValue || "None"}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Current Quantity</span>
              <p className="text-sm font-bold text-slate-950">{currentQuantity}</p>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Restock Details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Quantity to Add
            <input
              type="number"
              className={inputClass}
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 0))}
              required
            />
          </label>
          <div className="flex flex-col justify-end p-3 rounded-md bg-blue-50 border border-blue-100 text-blue-900">
            <span className="text-xs font-semibold uppercase">New Quantity Preview</span>
            <p className="text-xl font-bold">{newQuantityPreview}</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Financials & Vendor (Optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Unit Cost
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="e.g. 12.50"
            />
          </label>
          <label className={labelClass}>
            Vendor Name
            <input
              type="text"
              className={inputClass}
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Zebra Technologies"
            />
          </label>
          <label className={labelClass}>
            Storage Location
            <input
              type="text"
              className={inputClass}
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="e.g. IT Cage Shelf B2"
            />
          </label>
          <label className={labelClass}>
            Linked Factura
            <select
              className={inputClass}
              value={facturaId}
              onChange={(e) => setFacturaId(e.target.value)}
            >
              <option value="">No linked factura</option>
              {facturas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.facturaNumber} - {f.vendorName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <label className={labelClass + " block"}>
        Notes
        <textarea
          className={inputClass + " h-20"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for restock, purchase order details, etc."
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !selectedId}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <PackagePlus size={16} />
          {saving ? "Restocking..." : "Restock Item"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/stock")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
