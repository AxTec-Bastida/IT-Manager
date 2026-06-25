"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StockItem } from "@prisma/client";
import { AlertTriangle, CheckCircle, ClipboardList, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";

type Props = {
  stockItems: StockItem[];
  initialStockItemId?: string;
};

const reasons = [
  { value: "Physical count correction", label: "Physical count correction" },
  { value: "Damaged", label: "Damaged" },
  { value: "Lost", label: "Lost" },
  { value: "Found extra", label: "Found extra" },
  { value: "Data cleanup", label: "Data cleanup" },
  { value: "Other", label: "Other" },
];

export function StockCountForm({ stockItems, initialStockItemId = "" }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialStockItemId);
  const [countedQty, setCountedQty] = useState<number | "">("");
  const [reason, setReason] = useState<string>("Physical count correction");
  const [notes, setNotes] = useState<string>("");
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ id: string; name: string; counted: number; before: number; delta: number } | null>(null);

  const selectedItem = stockItems.find((item) => item.id === selectedId) ?? null;
  const currentQuantity = selectedItem ? selectedItem.quantityOnHand : 0;
  
  const delta = countedQty !== "" ? (countedQty - currentQuantity) : 0;
  const hasChange = countedQty !== "" && delta !== 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      setError("Please select a stock item.");
      return;
    }
    if (countedQty === "" || countedQty < 0) {
      setError("Please enter a valid physical count (zero or greater).");
      return;
    }

    setSaving(true);
    setError(null);

    // Determine target movementType based on count delta and selected reason
    let movementType = "PHYSICAL_COUNT";
    if (delta < 0) {
      if (reason === "Damaged") movementType = "DAMAGED";
      else if (reason === "Lost") movementType = "LOST";
    }

    try {
      const response = await fetch(`/api/stock/${selectedId}/movement`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          movementType,
          quantity: Math.abs(delta),
          adjustmentTarget: countedQty,
          reason: reason || "Physical count correction",
          notes: notes || `Counted physical quantity on shelf.`,
          performedBy: "IT Staff",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save physical count.");
      }

      setSuccessResult({
        id: selectedId,
        name: selectedItem?.name ?? "Item",
        counted: countedQty,
        before: currentQuantity,
        delta,
      });

      setCountedQty("");
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
            <h3 className="text-base font-semibold text-emerald-900">Physical Count Logged!</h3>
            <p className="text-emerald-700">Adjusted <strong>{successResult.name}</strong> from {successResult.before} to {successResult.counted} (Delta: {successResult.delta > 0 ? `+${successResult.delta}` : successResult.delta}).</p>
          </div>
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
            Adjust another
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
            onChange={(e) => {
              setSelectedId(e.target.value);
              setCountedQty("");
            }}
            required
          >
            <option value="">-- Choose item to count --</option>
            {stockItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} {item.barcodeValue ? `(${item.barcodeValue})` : ""} - System Qty: {item.quantityOnHand}
              </option>
            ))}
          </select>
        </label>

        {selectedItem && (
          <div className="grid gap-3 sm:grid-cols-2 rounded-md bg-slate-50 p-3.5 border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Storage Location</span>
              <p className="text-sm font-bold text-slate-950">{selectedItem.storageLocation || "Unset"}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Current System Quantity</span>
              <p className="text-sm font-bold text-slate-950">{currentQuantity}</p>
            </div>
          </div>
        )}
      </fieldset>

      {selectedId && (
        <fieldset className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <legend className="px-2 text-sm font-semibold text-slate-950"> shelf count comparison</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Counted Physical Quantity
              <input
                type="number"
                className={inputClass}
                min="0"
                value={countedQty}
                onChange={(e) => {
                  const val = e.target.value;
                  setCountedQty(val === "" ? "" : Math.max(0, parseInt(val, 10) || 0));
                }}
                placeholder="Enter physical count on shelf"
                required
              />
            </label>
            
            <div className="flex flex-col justify-end p-3 rounded-md bg-slate-100 border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold uppercase">Delta (System vs counted)</span>
              <p className={`text-xl font-bold ${delta < 0 ? "text-rose-600" : delta > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                {countedQty === "" ? "-" : delta > 0 ? `+${delta} (Found extra)` : delta < 0 ? `${delta} (Reduced)` : "0 (No change)"}
              </p>
            </div>
          </div>

          {countedQty !== "" && delta < 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-amber-800">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Warning: Quantity reduction</p>
                <p className="text-xs text-amber-700">This action will reduce the system quantity of this item by {Math.abs(delta)} unit(s). Please verify the physical count on the shelf matches {countedQty}.</p>
              </div>
            </div>
          )}

          {hasChange && (
            <label className={labelClass + " block animate-fade-in"}>
              Adjustment Reason
              <select
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                {reasons.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={labelClass + " block"}>
            Notes
            <textarea
              className={inputClass + " h-20"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. counted by John, bin check, damaged item found, etc."
            />
          </label>
        </fieldset>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !selectedId || countedQty === ""}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <ClipboardList size={16} />
          {saving ? "Adjusting..." : "Confirm Count / Adjust"}
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
