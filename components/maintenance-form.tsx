"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Device, StockItem } from "@prisma/client";
import { Camera, Save } from "lucide-react";
import { maintenanceTypeLabels, maintenanceTypeOptions, printerMaintenanceTypeOptions, scaleMaintenanceTypeOptions } from "@/lib/constants";
import { defaultMaintenanceTypeForAsset, maintenanceResultLabels, maintenanceResultOptions, testPrintResultOptions } from "@/lib/maintenance";

type Props = {
  asset: Device;
  stockItems: StockItem[];
};

export function MaintenanceForm({ asset, stockItems }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isPrinter = ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"].includes(asset.category);
  const isScale = asset.category === "SCALE";
  const typeOptions = isPrinter ? printerMaintenanceTypeOptions : isScale ? scaleMaintenanceTypeOptions : maintenanceTypeOptions;
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
            <select className={inputClass} name="maintenanceType" defaultValue={defaultMaintenanceTypeForAsset(asset)}>
              {typeOptions.map((type) => (
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
          <label className={labelClass}>
            Result
            <select className={inputClass} name="result" defaultValue="PASS">
              {maintenanceResultOptions.map((result) => (
                <option key={result} value={result}>{maintenanceResultLabels[result]}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Vendor ticket
            <input className={inputClass} name="vendorTicket" placeholder="Ticket / case number" />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Test / calibration details</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          {isPrinter ? (
            <>
              <label className={labelClass}>
                Page count / meter reading
                <input className={inputClass} name="measuredValue" inputMode="numeric" pattern="[0-9]*" placeholder="Example: 125430" />
              </label>
              <label className={labelClass}>
                Test print result
                <select className={inputClass} name="resultDetails" defaultValue="">
                  <option value="">Not a test print / not recorded</option>
                  {testPrintResultOptions.map((result) => <option key={result} value={result}>{result}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Old level / previous reading
                <input className={inputClass} name="previousPartInfo" placeholder="Example: black toner 8%" />
              </label>
              <label className={labelClass}>
                New level / new part
                <input className={inputClass} name="newPartInfo" placeholder="Example: black toner 100% / TN-850" />
              </label>
            </>
          ) : null}
          {isScale ? (
            <>
              <label className={labelClass}>
                Test weight used
                <input className={inputClass} name="testWeight" placeholder="Example: 5 kg certified weight" />
              </label>
              <label className={labelClass}>
                Expected value
                <input className={inputClass} name="expectedValue" placeholder="Example: 5.000 kg" />
              </label>
              <label className={labelClass}>
                Measured value
                <input className={inputClass} name="measuredValue" placeholder="Example: 5.002 kg" />
              </label>
            </>
          ) : null}
          {!isPrinter && !isScale ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 lg:col-span-2">This asset is not classified as a printer or scale. Use notes for general maintenance details.</p> : null}
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
            Part number / SKU / serial
            <input className={inputClass} name="partSerialNumber" placeholder={isPrinter ? "Toner, ink, drum, roller, or printhead SKU" : ""} />
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
          {!isPrinter ? (
            <>
              <label className={`${labelClass} lg:col-span-2`}>
                Previous part info
                <input className={inputClass} name="previousPartInfo" />
              </label>
              <label className={`${labelClass} lg:col-span-2`}>
                New part info
                <input className={inputClass} name="newPartInfo" />
              </label>
            </>
          ) : null}
          <label className={`${labelClass} lg:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} placeholder="Required for Fail or Needs follow-up. Include issue, action taken, and next step." />
          </label>
        </div>
      </fieldset>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Need evidence? Save the record, then add a test print, damaged part, or scale display photo from the asset photo panel.</p>
          <a href={`/devices/${asset.id}#photos`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-sky-300 bg-white px-3 font-semibold text-sky-900 hover:bg-sky-100">
            <Camera size={15} />
            Add evidence photo
          </a>
        </div>
      </div>

      <div className="sticky bottom-20 z-20 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save maintenance"}
        </button>
      </div>
    </form>
  );
}
