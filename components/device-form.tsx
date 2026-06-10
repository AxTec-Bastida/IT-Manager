"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Device, DeviceCategory, Employee, Factura, IpRange, LocationZone } from "@prisma/client";
import { Save } from "lucide-react";
import { ScanFieldButton } from "@/components/camera-scanner";
import { categoryLabels, categoryOptions, conditionLabels, conditionOptions, statusLabels, statusOptions } from "@/lib/constants";

type DeviceFormProps = {
  device?: Device | null;
  ranges: IpRange[];
  employees?: Employee[];
  facturas?: Factura[];
  zones?: LocationZone[];
  defaults?: { vlan: number; category: DeviceCategory };
};

export function DeviceForm({ device, ranges, employees = [], facturas = [], zones = [], defaults }: DeviceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(device?.name ?? searchParams.get("name") ?? "");
  const [ipAddress, setIpAddress] = useState(device?.ipAddress ?? searchParams.get("ipAddress") ?? "");
  const [macAddress, setMacAddress] = useState(device?.macAddress ?? searchParams.get("macAddress") ?? "");
  const [serialNumber, setSerialNumber] = useState(device?.serialNumber ?? searchParams.get("serialNumber") ?? "");

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch(device ? `/api/devices/${device.id}` : "/api/devices", {
      method: device ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.error || "Unable to save device.");
      return;
    }

    router.push(`/devices/${data.device.id}`);
    router.refresh();
  }

  const inputClass = "w-full min-h-14 rounded-md sm:min-h-12 border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";
  const scanInputWrap = "grid gap-2 sm:grid-cols-[1fr_auto]";

  return (
    <form action={onSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Basic info</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Asset tag / internal ID
            <input className={inputClass} name="assetTag" defaultValue={device?.assetTag ?? searchParams.get("assetTag") ?? ""} placeholder="IT-000123" />
          </label>

          <label className={labelClass}>
            Device name
            <div className={scanInputWrap}>
              <input className={inputClass} name="name" value={name} onChange={(event) => setName(event.target.value)} required />
              <ScanFieldButton target="name" onValue={setName} />
            </div>
          </label>

          <label className={labelClass}>
            Category
            <select className={inputClass} name="category" defaultValue={device?.category ?? defaults?.category ?? "OTHER"}>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Status / condition</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Status
            <select className={inputClass} name="status" defaultValue={device?.status ?? "ACTIVE"}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Condition
            <select className={inputClass} name="condition" defaultValue={device?.condition ?? "GOOD"}>
              {conditionOptions.map((condition) => (
                <option key={condition} value={condition}>
                  {conditionLabels[condition]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Network / IPAM</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            IP address
            <div className={scanInputWrap}>
              <input className={inputClass} name="ipAddress" value={ipAddress ?? ""} onChange={(event) => setIpAddress(event.target.value)} placeholder="Optional, e.g. 192.168.163.25" />
              <ScanFieldButton target="ipAddress" onValue={setIpAddress} />
            </div>
          </label>
          <label className={labelClass}>
            VLAN
            <input className={inputClass} name="vlan" type="number" min="1" max="4094" defaultValue={device?.vlan ?? ""} placeholder={`Optional${defaults?.vlan ? `, default ${defaults.vlan}` : ""}`} />
          </label>
          <label className={labelClass}>
            IP range/pool
            <select className={inputClass} name="ipRangeId" defaultValue={device?.ipRangeId ?? ""}>
              <option value="">No assigned range</option>
              {ranges.map((range) => (
                <option key={range.id} value={range.id}>
                  {range.name} ({range.startIp} - {range.endIp})
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            MAC address
            <div className={scanInputWrap}>
              <input className={inputClass} name="macAddress" value={macAddress} onChange={(event) => setMacAddress(event.target.value)} placeholder="00:11:22:33:44:55" />
              <ScanFieldButton target="macAddress" onValue={setMacAddress} />
            </div>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Location / assignment</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Location
            <input className={inputClass} name="location" defaultValue={device?.location ?? ""} />
          </label>
          <label className={labelClass}>
            Area / department
            <input className={inputClass} name="areaDepartment" defaultValue={device?.areaDepartment ?? ""} />
          </label>
          <label className={labelClass}>
            Brand
            <input className={inputClass} name="brand" defaultValue={device?.brand ?? ""} />
          </label>
          <label className={labelClass}>
            Model
            <input className={inputClass} name="model" defaultValue={device?.model ?? ""} />
          </label>
          <label className={labelClass}>
            Serial number
            <div className={scanInputWrap}>
              <input className={inputClass} name="serialNumber" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
              <ScanFieldButton target="serialNumber" onValue={setSerialNumber} />
            </div>
          </label>
          <label className={labelClass}>
            Assigned user/department
            <input className={inputClass} name="assignedTo" defaultValue={device?.assignedTo ?? ""} />
          </label>
          <label className={labelClass}>
            Assigned employee
            <select className={inputClass} name="employeeId" defaultValue={device?.employeeId ?? ""}>
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} {employee.employeeId ? `(${employee.employeeId})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
        <legend className="px-2 text-sm font-semibold text-slate-950">Purchase / factura</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Purchase date
            <input className={inputClass} name="purchaseDate" type="date" defaultValue={device?.purchaseDate ? device.purchaseDate.toISOString().slice(0, 10) : ""} />
          </label>
          <label className={labelClass}>
            Warranty expiration
            <input className={inputClass} name="warrantyExpiresAt" type="date" defaultValue={device?.warrantyExpiresAt ? device.warrantyExpiresAt.toISOString().slice(0, 10) : ""} />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Linked factura / purchase record
            <select className={inputClass} name="facturaId" defaultValue={device?.facturaId ?? ""}>
              <option value="">No linked factura</option>
              {facturas.map((factura) => (
                <option key={factura.id} value={factura.id}>
                  {factura.facturaNumber} - {factura.vendorName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-2">
        <legend className="px-2 text-sm font-semibold text-slate-950">Fixed / static asset location fields</legend>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input className="size-4" name="isFixedAsset" type="checkbox" defaultChecked={device?.isFixedAsset ?? false} />
          Fixed/installed asset
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input className="size-4" name="usesStaticIp" type="checkbox" defaultChecked={device?.usesStaticIp ?? Boolean(device?.ipAddress)} />
          Uses static IP
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input className="size-4" name="movementAlertsEnabled" type="checkbox" defaultChecked={device?.movementAlertsEnabled ?? false} />
          Legacy AP-based movement alert flag
        </label>
        <label className={labelClass}>
          Allowed zone distance for legacy AP review
          <input className={inputClass} name="allowedZoneDistance" type="number" min="0" max="10" defaultValue={device?.allowedZoneDistance ?? 0} />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Expected location zone
          <select className={inputClass} name="expectedLocationZoneId" defaultValue={device?.expectedLocationZoneId ?? ""}>
            <option value="">No expected zone</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
          </select>
        </label>
      </fieldset>
      <label className={`${labelClass} lg:col-span-2`}>
        RMA / repair notes
        <textarea className={inputClass} name="repairNotes" rows={3} defaultValue={device?.repairNotes ?? ""} />
      </label>

      <fieldset className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2 lg:grid-cols-2">
        <legend className="px-2 text-sm font-semibold text-slate-950">Printer supplies and maintenance</legend>
        <label className={labelClass}>
          Black toner/ink %
          <input className={inputClass} name="blackTonerLevel" type="number" min="0" max="100" defaultValue={device?.blackTonerLevel ?? ""} />
        </label>
        <label className={labelClass}>
          Cyan toner/ink %
          <input className={inputClass} name="cyanTonerLevel" type="number" min="0" max="100" defaultValue={device?.cyanTonerLevel ?? ""} />
        </label>
        <label className={labelClass}>
          Magenta toner/ink %
          <input className={inputClass} name="magentaTonerLevel" type="number" min="0" max="100" defaultValue={device?.magentaTonerLevel ?? ""} />
        </label>
        <label className={labelClass}>
          Yellow toner/ink %
          <input className={inputClass} name="yellowTonerLevel" type="number" min="0" max="100" defaultValue={device?.yellowTonerLevel ?? ""} />
        </label>
        <label className={labelClass}>
          Drum level %
          <input className={inputClass} name="drumLevel" type="number" min="0" max="100" defaultValue={device?.drumLevel ?? ""} />
        </label>
        <label className={labelClass}>
          Low supply threshold %
          <input className={inputClass} name="lowSupplyThreshold" type="number" min="0" max="100" defaultValue={device?.lowSupplyThreshold ?? ""} />
        </label>
        <label className={labelClass}>
          Page count / meter
          <input className={inputClass} name="pageCount" type="number" min="0" defaultValue={device?.pageCount ?? ""} />
        </label>
        <label className={labelClass}>
          Fuser / kit status
          <input className={inputClass} name="fuserStatus" defaultValue={device?.fuserStatus ?? ""} />
        </label>
        <label className={labelClass}>
          Last supply replacement
          <input className={inputClass} name="lastSupplyReplacementAt" type="date" defaultValue={device?.lastSupplyReplacementAt ? device.lastSupplyReplacementAt.toISOString().slice(0, 10) : ""} />
        </label>
        <label className={labelClass}>
          Last cleaned
          <input className={inputClass} name="lastCleanedAt" type="date" defaultValue={device?.lastCleanedAt ? device.lastCleanedAt.toISOString().slice(0, 10) : ""} />
        </label>
        <label className={labelClass}>
          Cleaning interval days
          <input className={inputClass} name="cleaningIntervalDays" type="number" min="1" defaultValue={device?.cleaningIntervalDays ?? ""} />
        </label>
        <label className={labelClass}>
          Maintenance due
          <input className={inputClass} name="maintenanceDueAt" type="date" defaultValue={device?.maintenanceDueAt ? device.maintenanceDueAt.toISOString().slice(0, 10) : ""} />
        </label>
        <label className={labelClass}>
          Last printhead replacement
          <input className={inputClass} name="lastPrintheadReplacementAt" type="date" defaultValue={device?.lastPrintheadReplacementAt ? device.lastPrintheadReplacementAt.toISOString().slice(0, 10) : ""} />
        </label>
        <label className={labelClass}>
          Last platen roller replacement
          <input className={inputClass} name="lastPlatenRollerReplacementAt" type="date" defaultValue={device?.lastPlatenRollerReplacementAt ? device.lastPlatenRollerReplacementAt.toISOString().slice(0, 10) : ""} />
        </label>
        <label className={labelClass}>
          Last cutter replacement
          <input className={inputClass} name="lastCutterReplacementAt" type="date" defaultValue={device?.lastCutterReplacementAt ? device.lastCutterReplacementAt.toISOString().slice(0, 10) : ""} />
        </label>
        <label className={labelClass}>
          Estimated printhead life
          <input className={inputClass} name="estimatedPrintheadLife" type="number" min="0" defaultValue={device?.estimatedPrintheadLife ?? ""} />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Maintenance notes
          <textarea className={inputClass} name="maintenanceNotes" rows={3} defaultValue={device?.maintenanceNotes ?? ""} />
        </label>
      </fieldset>

      <label className={`${labelClass} lg:col-span-2`}>
        Notes
        <textarea className={inputClass} name="notes" rows={4} defaultValue={device?.notes ?? ""} />
      </label>
      <div className="lg:col-span-2">
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save device"}
        </button>
      </div>
    </form>
  );
}
