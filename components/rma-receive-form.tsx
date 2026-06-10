"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Device, RmaCase, RmaItem } from "@prisma/client";
import { Save } from "lucide-react";
import { Badge } from "@/components/badge";
import { rmaItemResultLabels, rmaItemResultTone } from "@/lib/constants";

type RmaReceiveCase = RmaCase & {
  items: Array<RmaItem & { device: Pick<Device, "id" | "name" | "assetTag" | "serialNumber" | "model" | "status">; replacementDevice?: Pick<Device, "id" | "name" | "assetTag"> | null }>;
};

type DeviceOption = Pick<Device, "id" | "name" | "assetTag" | "serialNumber">;

export function RmaReceiveForm({ rma, devices }: { rma: RmaReceiveCase; devices: DeviceOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingItems = rma.items.filter((item) => item.result === "PENDING");
  const inputClass = "w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none";

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const items = pendingItems.map((item) => ({
      itemId: item.id,
      selected: formData.get(`selected-${item.id}`) === "on",
      result: formData.get(`result-${item.id}`),
      returnCondition: formData.get(`condition-${item.id}`),
      returnedAt: formData.get(`returnedAt-${item.id}`),
      replacementDeviceId: formData.get(`replacement-${item.id}`),
      notes: formData.get(`notes-${item.id}`),
    }));
    const response = await fetch(`/api/rma/${rma.id}/receive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to receive RMA items.");
      return;
    }
    router.push(`/rma/${data.rma.id}`);
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-4">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}
      {pendingItems.map((item) => (
        <section key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="flex gap-3">
            <input type="checkbox" name={`selected-${item.id}`} className="mt-1 size-5 shrink-0" defaultChecked />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-slate-950">{item.device.name}</span>
              <span className="mt-1 block text-sm text-slate-500">{item.device.assetTag || "No tag"} / {item.device.serialNumber || "No serial"}</span>
            </span>
            <Badge className={rmaItemResultTone[item.result]}>{rmaItemResultLabels[item.result]}</Badge>
          </label>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Result
              <select className={inputClass} name={`result-${item.id}`} defaultValue="REPAIRED">
                {Object.entries(rmaItemResultLabels).filter(([value]) => value !== "PENDING").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Return condition
              <select className={inputClass} name={`condition-${item.id}`} defaultValue="GOOD">
                {["GOOD", "FAIR", "DAMAGED", "NOT_WORKING", "NEEDS_REVIEW"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Returned date
              <input className={inputClass} name={`returnedAt-${item.id}`} type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Replacement device
              <select className={inputClass} name={`replacement-${item.id}`} defaultValue="">
                <option value="">No replacement device</option>
                {devices.map((device) => <option key={device.id} value={device.id}>{device.assetTag ? `${device.assetTag} - ` : ""}{device.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
              Notes
              <textarea className={inputClass} name={`notes-${item.id}`} rows={3} />
            </label>
          </div>
        </section>
      ))}
      {pendingItems.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">No pending RMA items remain for this case.</div>
      ) : null}
      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving || pendingItems.length === 0}>
        <Save size={17} />
        {saving ? "Saving..." : "Receive selected devices"}
      </button>
    </form>
  );
}
