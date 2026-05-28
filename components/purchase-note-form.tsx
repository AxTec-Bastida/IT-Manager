"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Device, Factura, PurchaseNote, PurchaseNoteItem, StockItem } from "@prisma/client";
import { Save } from "lucide-react";
import { purchaseNoteStatusLabels, purchaseNoteStatusOptions, taskPriorityLabels, taskPriorityOptions } from "@/lib/constants";

type PurchaseWithItems = PurchaseNote & { items?: PurchaseNoteItem[] };

type Props = {
  purchaseNote?: PurchaseWithItems | null;
  facturas: Pick<Factura, "id" | "facturaNumber" | "vendorName">[];
  stockItems: Pick<StockItem, "id" | "name" | "sku">[];
  devices: Pick<Device, "id" | "name" | "assetTag">[];
};

export function PurchaseNoteForm({ purchaseNote, facturas, stockItems, devices }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstItem = purchaseNote?.items?.[0];
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const itemDescription = String(formData.get("itemDescription") ?? "").trim();
    const payload = {
      ...Object.fromEntries(formData.entries()),
      items: itemDescription
        ? [{
            description: itemDescription,
            quantity: formData.get("itemQuantity"),
            unitCost: formData.get("itemUnitCost"),
            relatedStockItemId: formData.get("itemStockItemId"),
            relatedDeviceId: formData.get("itemDeviceId"),
            notes: formData.get("itemNotes"),
          }]
        : [],
    };
    for (const key of ["itemDescription", "itemQuantity", "itemUnitCost", "itemStockItemId", "itemDeviceId", "itemNotes"]) {
      delete (payload as Record<string, unknown>)[key];
    }
    const response = await fetch(purchaseNote ? `/api/po-tracker/${purchaseNote.id}` : "/api/po-tracker", {
      method: purchaseNote ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save PO tracker note.");
      return;
    }
    router.push(`/po-tracker/${data.purchaseNote.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">PO tracker note</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            PO number
            <input className={inputClass} name="poNumber" defaultValue={purchaseNote?.poNumber ?? searchParams.get("poNumber") ?? ""} />
          </label>
          <label className={labelClass}>
            Vendor
            <input className={inputClass} name="vendorName" defaultValue={purchaseNote?.vendorName ?? ""} />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Title
            <input className={inputClass} name="title" defaultValue={purchaseNote?.title ?? searchParams.get("title") ?? ""} required />
          </label>
          <label className={labelClass}>
            Status
            <select className={inputClass} name="status" defaultValue={purchaseNote?.status ?? "DRAFT"}>
              {purchaseNoteStatusOptions.map((status) => <option key={status} value={status}>{purchaseNoteStatusLabels[status]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Priority
            <select className={inputClass} name="priority" defaultValue={purchaseNote?.priority ?? ""}>
              <option value="">No priority</option>
              {taskPriorityOptions.map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Requested by
            <input className={inputClass} name="requestedBy" defaultValue={purchaseNote?.requestedBy ?? ""} />
          </label>
          <label className={labelClass}>
            Related factura
            <select className={inputClass} name="relatedFacturaId" defaultValue={purchaseNote?.relatedFacturaId ?? searchParams.get("relatedFacturaId") ?? ""}>
              <option value="">No related factura</option>
              {facturas.map((factura) => <option key={factura.id} value={factura.id}>{factura.facturaNumber} - {factura.vendorName}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Dates / amount</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <DateField label="Requested" name="requestedAt" value={purchaseNote?.requestedAt} />
          <DateField label="Approved" name="approvedAt" value={purchaseNote?.approvedAt} />
          <DateField label="Ordered" name="orderedAt" value={purchaseNote?.orderedAt} />
          <DateField label="Expected delivery" name="expectedDeliveryAt" value={purchaseNote?.expectedDeliveryAt} />
          <DateField label="Received" name="receivedAt" value={purchaseNote?.receivedAt} />
          <DateField label="Follow up" name="followUpDate" value={purchaseNote?.followUpDate} />
          <label className={labelClass}>
            Estimated amount
            <input className={inputClass} name="estimatedAmount" type="number" min="0" step="0.01" defaultValue={purchaseNote?.estimatedAmount ?? ""} />
          </label>
          <label className={labelClass}>
            Currency
            <input className={inputClass} name="currency" defaultValue={purchaseNote?.currency ?? "USD"} />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Requested item</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={`${labelClass} lg:col-span-2`}>
            Description
            <input className={inputClass} name="itemDescription" defaultValue={firstItem?.description ?? ""} placeholder="Keyboards, toner, printer part, replacement scanner" />
          </label>
          <label className={labelClass}>
            Quantity
            <input className={inputClass} name="itemQuantity" type="number" min="1" defaultValue={firstItem?.quantity ?? ""} />
          </label>
          <label className={labelClass}>
            Unit cost
            <input className={inputClass} name="itemUnitCost" type="number" min="0" step="0.01" defaultValue={firstItem?.unitCost ?? ""} />
          </label>
          <label className={labelClass}>
            Related stock item
            <select className={inputClass} name="itemStockItemId" defaultValue={firstItem?.relatedStockItemId ?? searchParams.get("relatedStockItemId") ?? ""}>
              <option value="">No related stock item</option>
              {stockItems.map((item) => <option key={item.id} value={item.id}>{item.sku ? `${item.sku} - ` : ""}{item.name}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Related asset
            <select className={inputClass} name="itemDeviceId" defaultValue={firstItem?.relatedDeviceId ?? ""}>
              <option value="">No related asset</option>
              {devices.map((device) => <option key={device.id} value={device.id}>{device.assetTag ? `${device.assetTag} - ` : ""}{device.name}</option>)}
            </select>
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Item notes
            <input className={inputClass} name="itemNotes" defaultValue={firstItem?.notes ?? ""} />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className={labelClass}>
          Notes
          <textarea className={inputClass} name="notes" rows={4} defaultValue={purchaseNote?.notes ?? ""} />
        </label>
      </section>

      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving}>
        <Save size={17} />
        {saving ? "Saving..." : "Save PO note"}
      </button>
    </form>
  );
}

function DateField({ label, name, value }: { label: string; name: string; value?: Date | null }) {
  return (
    <label className="space-y-1 text-sm font-medium text-slate-700">
      {label}
      <input className="w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm" name={name} type="date" defaultValue={value ? value.toISOString().slice(0, 10) : ""} />
    </label>
  );
}
