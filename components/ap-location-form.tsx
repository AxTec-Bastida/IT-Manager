"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccessPointMapLocation, LocationZone, WarehouseMap } from "@prisma/client";
import { Save } from "lucide-react";

export function ApLocationForm({ accessPoint, maps, zones = [] }: { accessPoint?: AccessPointMapLocation | null; maps: WarehouseMap[]; zones?: LocationZone[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = { ...Object.fromEntries(formData.entries()), active: formData.get("active") === "on" };
    const response = await fetch(accessPoint ? `/api/ap-locations/${accessPoint.id}` : "/api/ap-locations", {
      method: accessPoint ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to save AP map location.");
      return;
    }
    router.push("/map");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-5 lg:grid-cols-2">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 lg:col-span-2">{error}</div> : null}
      <label className={labelClass}>
        AP name
        <input className={inputClass} name="apName" defaultValue={accessPoint?.apName ?? ""} required />
      </label>
      <label className={labelClass}>
        AP MAC
        <input className={inputClass} name="apMac" defaultValue={accessPoint?.apMac ?? ""} required />
      </label>
      <label className={labelClass}>
        UniFi device ID
        <input className={inputClass} name="unifiDeviceId" defaultValue={accessPoint?.unifiDeviceId ?? ""} />
      </label>
      <label className={labelClass}>
        Location label
        <input className={inputClass} name="locationLabel" defaultValue={accessPoint?.locationLabel ?? ""} required />
      </label>
      <label className={labelClass}>
        Floor name
        <input className={inputClass} name="floorName" defaultValue={accessPoint?.floorName ?? ""} />
      </label>
      <label className={labelClass}>
        Map
        <select className={inputClass} name="mapId" defaultValue={accessPoint?.mapId ?? maps.find((map) => map.active)?.id ?? ""}>
          <option value="">No map</option>
          {maps.map((map) => (
            <option key={map.id} value={map.id}>{map.name}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Location zone
        <select className={inputClass} name="locationZoneId" defaultValue={accessPoint?.locationZoneId ?? ""}>
          <option value="">No zone</option>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Zone order
        <input className={inputClass} name="zoneOrder" type="number" min="0" defaultValue={accessPoint?.zoneOrder ?? ""} />
      </label>
      <label className={labelClass}>
        X coordinate %
        <input className={inputClass} name="x" type="number" min="0" max="100" step="0.1" defaultValue={accessPoint?.x ?? 50} required />
      </label>
      <label className={labelClass}>
        Y coordinate %
        <input className={inputClass} name="y" type="number" min="0" max="100" step="0.1" defaultValue={accessPoint?.y ?? 50} required />
      </label>
      <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
        <input className="size-4 rounded border-slate-300" name="active" type="checkbox" defaultChecked={accessPoint?.active ?? true} />
        Active AP location
      </label>
      <label className={`${labelClass} lg:col-span-2`}>
        Notes
        <textarea className={inputClass} name="notes" rows={4} defaultValue={accessPoint?.notes ?? ""} />
      </label>
      <div className="lg:col-span-2">
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save AP location"}
        </button>
      </div>
    </form>
  );
}
