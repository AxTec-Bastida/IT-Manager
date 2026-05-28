"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Employee, Factura, StockItem } from "@prisma/client";
import { Save } from "lucide-react";
import { stockMovementTypeLabels, stockMovementTypeOptions } from "@/lib/constants";

export function StockMovementForm({ stockItem, employees = [], facturas = [] }: { stockItem: StockItem; employees?: Employee[]; facturas?: Factura[] }) {
  const router = useRouter();
  const [movementType, setMovementType] = useState("ADD");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch(`/api/stock/${stockItem.id}/movement`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    setMessage(response.ok ? "Stock movement saved." : data.error || "Unable to save stock movement.");
    if (response.ok) router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-3">
      {message ? <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{message}</div> : null}
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Action
        <select className={inputClass} name="movementType" value={movementType} onChange={(event) => setMovementType(event.target.value)}>
          {stockMovementTypeOptions.map((type) => (
            <option key={type} value={type}>
              {stockMovementTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Quantity
        <input className={inputClass} name="quantity" type="number" min="1" defaultValue={1} />
      </label>
      {movementType === "ADJUST" ? (
        <label className="space-y-1 text-sm font-medium text-slate-700">
          New on-hand quantity
          <input className={inputClass} name="adjustmentTarget" type="number" min="0" defaultValue={stockItem.quantityOnHand} />
        </label>
      ) : null}
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Employee for handout
        <select className={inputClass} name="employeeId" defaultValue="">
          <option value="">No employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} {employee.employeeId ? `(${employee.employeeId})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Reason
        <input className={inputClass} name="reason" placeholder="Factura, physical count, handout, damaged" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Factura / purchase record
        <select className={inputClass} name="facturaId" defaultValue="">
          <option value="">No linked factura</option>
          {facturas.map((factura) => (
            <option key={factura.id} value={factura.id}>
              {factura.facturaNumber} - {factura.vendorName}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Notes
        <textarea className={inputClass} name="notes" rows={3} />
      </label>
      <button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12" disabled={saving}>
        <Save size={16} />
        {saving ? "Saving..." : "Save movement"}
      </button>
    </form>
  );
}
