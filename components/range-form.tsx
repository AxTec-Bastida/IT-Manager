"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeviceCategory, IpRange } from "@prisma/client";
import { Save } from "lucide-react";
import { categoryLabels, categoryOptions } from "@/lib/constants";

export function RangeForm({ range, defaults }: { range?: IpRange | null; defaults?: { vlan: number; category: DeviceCategory } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-12 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = { ...Object.fromEntries(formData.entries()), active: formData.get("active") === "on" };
    const response = await fetch(range ? `/api/ranges/${range.id}` : "/api/ranges", {
      method: range ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to save range.");
      return;
    }
    router.push("/ranges");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-4 lg:grid-cols-2">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 lg:col-span-2">{error}</div> : null}
      <label className={labelClass}>
        Range name
        <input className={inputClass} name="name" defaultValue={range?.name ?? ""} required />
      </label>
      <label className={labelClass}>
        Category
        <select className={inputClass} name="category" defaultValue={range?.category ?? defaults?.category ?? "OTHER"}>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {categoryLabels[category]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        VLAN ID
        <input className={inputClass} name="vlan" type="number" min="1" max="4094" defaultValue={range?.vlan ?? defaults?.vlan ?? 10} required />
      </label>
      <label className={labelClass}>
        Subnet label
        <input className={inputClass} name="subnet" defaultValue={range?.subnet ?? ""} placeholder="192.168.163.0/24" />
      </label>
      <label className={labelClass}>
        Start IP
        <input className={inputClass} name="startIp" defaultValue={range?.startIp ?? ""} required />
      </label>
      <label className={labelClass}>
        End IP
        <input className={inputClass} name="endIp" defaultValue={range?.endIp ?? ""} required />
      </label>
      <label className={labelClass}>
        Location/area
        <input className={inputClass} name="location" defaultValue={range?.location ?? ""} />
      </label>
      <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
        <input className="size-4 rounded border-slate-300" name="active" type="checkbox" defaultChecked={range?.active ?? true} />
        Active pool
      </label>
      <label className={`${labelClass} lg:col-span-2`}>
        Notes
        <textarea className={inputClass} name="notes" rows={4} defaultValue={range?.notes ?? ""} />
      </label>
      <div className="lg:col-span-2">
        <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save range"}
        </button>
      </div>
    </form>
  );
}
