"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Device, RmaCase, RmaItem } from "@prisma/client";
import { AlertTriangle, Save, Search } from "lucide-react";
import { Badge } from "@/components/badge";
import { categoryLabels, statusLabels } from "@/lib/constants";

type DeviceOption = Pick<Device, "id" | "name" | "assetTag" | "serialNumber" | "model" | "category" | "status" | "assignedTo" | "employeeId"> & {
  employee?: { fullName: string } | null;
};

type RmaWithItems = RmaCase & { items: Array<RmaItem & { device: DeviceOption }> };

export function RmaForm({ devices, rma, initialDeviceIds = [] }: { devices: DeviceOption[]; rma?: RmaWithItems | null; initialDeviceIds?: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(() => new Set(rma?.items.map((item) => item.deviceId) ?? initialDeviceIds));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  const selectedDevices = devices.filter((device) => selected.has(device.id));
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return devices.filter((device) => {
      const haystack = `${device.name} ${device.assetTag ?? ""} ${device.serialNumber ?? ""} ${device.model ?? ""} ${device.assignedTo ?? ""} ${device.employee?.fullName ?? ""}`.toLowerCase();
      return (!text || haystack.includes(text)) && (!category || device.category === category);
    }).slice(0, 80);
  }, [devices, query, category]);

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = { ...Object.fromEntries(formData.entries()), deviceIds: [...selected] };
    const response = await fetch(rma ? `/api/rma/${rma.id}` : "/api/rma", {
      method: rma ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save RMA.");
      return;
    }
    router.push(`/rma/${data.rma.id}`);
    router.refresh();
  }

  function toggle(deviceId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }

  const assignedSelected = selectedDevices.filter((device) => device.assignedTo || device.employee);

  return (
    <form action={submit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">1. RMA details</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            RMA number
            <input className={inputClass} name="rmaNumber" defaultValue={rma?.rmaNumber ?? ""} required placeholder="14" />
          </label>
          <label className={labelClass}>
            Status
            <select className={inputClass} name="status" defaultValue={rma?.status ?? "SENT"}>
              {["DRAFT", "SENT", "ACTIVE", "PARTIALLY_RETURNED", "RETURNED", "CLOSED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Title
            <input className={inputClass} name="title" defaultValue={rma?.title ?? ""} placeholder="iPod repair batch" />
          </label>
          <label className={labelClass}>
            Destination
            <input className={inputClass} name="destination" defaultValue={rma?.destination ?? "USA repair center"} required />
          </label>
          <label className={labelClass}>
            Vendor
            <input className={inputClass} name="vendorName" defaultValue={rma?.vendorName ?? ""} />
          </label>
          <label className={labelClass}>
            Contact name
            <input className={inputClass} name="contactName" defaultValue={rma?.contactName ?? ""} />
          </label>
          <label className={labelClass}>
            Contact email
            <input className={inputClass} name="contactEmail" type="email" defaultValue={rma?.contactEmail ?? ""} />
          </label>
          <label className={labelClass}>
            Carrier
            <input className={inputClass} name="carrier" defaultValue={rma?.carrier ?? ""} />
          </label>
          <label className={labelClass}>
            Tracking number
            <input className={inputClass} name="trackingNumber" defaultValue={rma?.trackingNumber ?? ""} />
          </label>
          <label className={labelClass}>
            Sent date
            <input className={inputClass} name="sentAt" type="date" defaultValue={dateValue(rma?.sentAt)} />
          </label>
          <label className={labelClass}>
            Reminder after days
            <input className={inputClass} name="reminderAfterDays" type="number" min="1" defaultValue={rma?.reminderAfterDays ?? 7} />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} defaultValue={rma?.notes ?? ""} />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Issue description for newly added devices
            <textarea className={inputClass} name="issueDescription" rows={3} placeholder="Screen broken, battery issue, will not power on..." />
          </label>
          <label className={labelClass}>
            Condition sent
            <input className={inputClass} name="conditionSent" placeholder="Fair, damaged, not working" />
          </label>
          <label className={labelClass}>
            Accessories sent
            <input className={inputClass} name="accessoriesSent" placeholder="Cable, case, charger" />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">2. Select devices</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
          <label className={labelClass}>
            Search assets
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-4 text-slate-400" size={18} />
              <input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Asset tag, serial, model, employee" />
            </span>
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">{selected.size} selected</div>
        {assignedSelected.length ? (
          <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>{assignedSelected.length} selected asset{assignedSelected.length === 1 ? " is" : "s are"} currently assigned. Sending to RMA makes them unavailable, but assignment history is preserved.</p>
          </div>
        ) : null}
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {filtered.map((device) => (
            <label key={device.id} className="flex min-h-24 gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0" checked={selected.has(device.id)} onChange={() => toggle(device.id)} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">{device.name}</span>
                  <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[device.category as keyof typeof categoryLabels] ?? device.category}</Badge>
                </span>
                <span className="mt-1 block text-sm text-slate-500">{device.assetTag || "No tag"} / {device.serialNumber || "No serial"}</span>
                <span className="block text-sm text-slate-500">{device.model || "No model"} / {statusLabels[device.status as keyof typeof statusLabels] ?? device.status}</span>
                {device.assignedTo || device.employee ? <span className="mt-1 block text-sm font-medium text-amber-700">Assigned to {device.employee?.fullName || device.assignedTo}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">3. Review selected devices</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {selectedDevices.slice(0, 40).map((device) => (
            <div key={device.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-950">{device.name}</p>
              <p className="text-slate-600">{device.assetTag || "No tag"} / {device.serialNumber || "No serial"}</p>
            </div>
          ))}
        </div>
        {selectedDevices.length > 40 ? <p className="mt-2 text-sm text-slate-500">Showing 40 of {selectedDevices.length} selected devices.</p> : null}
      </section>

      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving || selected.size === 0}>
        <Save size={17} />
        {saving ? "Saving..." : rma ? "Save RMA" : "Create RMA"}
      </button>
    </form>
  );
}

function dateValue(value?: Date | string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
