"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LocationZone, WarehouseMap } from "@prisma/client";
import { Save } from "lucide-react";

export function ZoneForm({ zone, maps }: { zone?: LocationZone | null; maps: WarehouseMap[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";

  async function onSubmit(formData: FormData) {
    const payload = { ...Object.fromEntries(formData.entries()), active: formData.get("active") === "on" };
    const response = await fetch(zone ? `/api/zones/${zone.id}` : "/api/zones", {
      method: zone ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Unable to save zone.");
      return;
    }
    router.push(`/zones/${data.zone.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-5 lg:grid-cols-2">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 lg:col-span-2">{message}</div> : null}
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Zone name
        <input className={inputClass} name="name" defaultValue={zone?.name ?? ""} required />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Floor name
        <input className={inputClass} name="floorName" defaultValue={zone?.floorName ?? ""} />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Map
        <select className={inputClass} name="mapId" defaultValue={zone?.mapId ?? ""}>
          <option value="">No map</option>
          {maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Color
        <input className={inputClass} name="color" defaultValue={zone?.color ?? "#2563eb"} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input className="size-4" name="active" type="checkbox" defaultChecked={zone?.active ?? true} />
        Active
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
        Description
        <textarea className={inputClass} name="description" rows={4} defaultValue={zone?.description ?? ""} />
      </label>
      <div className="lg:col-span-2">
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 sm:min-h-12 sm:w-auto sm:text-sm">
          <Save size={16} />
          Save zone
        </button>
      </div>
    </form>
  );
}
