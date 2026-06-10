"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useMemo, useState } from "react";
import type { AccessPointMapLocation, LocationZone, WarehouseMap } from "@prisma/client";
import { MapPin, Save } from "lucide-react";
import { buildAnchorDisplayPath, pointToMapPercent } from "@/lib/map-anchors";

type MapAnchor = AccessPointMapLocation & {
  area?: string | null;
  department?: string | null;
  station?: string | null;
  displayPath?: string | null;
};

export function ApLocationForm({ accessPoint, maps, zones = [] }: { accessPoint?: MapAnchor | null; maps: WarehouseMap[]; zones?: LocationZone[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapId, setMapId] = useState(accessPoint?.mapId ?? maps.find((map) => map.active)?.id ?? "");
  const [x, setX] = useState(String(accessPoint?.x ?? 50));
  const [y, setY] = useState(String(accessPoint?.y ?? 50));
  const [area, setArea] = useState(accessPoint?.area ?? "");
  const [department, setDepartment] = useState(accessPoint?.department ?? "");
  const [station, setStation] = useState(accessPoint?.station ?? "");
  const [locationLabel, setLocationLabel] = useState(accessPoint?.locationLabel ?? "");
  const [displayPath, setDisplayPath] = useState(accessPoint?.displayPath ?? "");
  const selectedMap = useMemo(() => maps.find((map) => map.id === mapId) ?? null, [mapId, maps]);
  const suggestedPath = buildAnchorDisplayPath({ area, department, station, locationLabel, displayPath });
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = { ...Object.fromEntries(formData.entries()), active: formData.get("active") === "on", displayPath: displayPath || suggestedPath };
    const response = await fetch(accessPoint ? `/api/ap-locations/${accessPoint.id}` : "/api/ap-locations", {
      method: accessPoint ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to save map anchor.");
      return;
    }
    router.push("/map");
    router.refresh();
  }

  function placeAnchor(event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = pointToMapPercent(event.clientX, event.clientY, rect);
    setX(String(point.x));
    setY(String(point.y));
  }

  return (
    <form action={onSubmit} className="grid gap-5 lg:grid-cols-2">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 lg:col-span-2">{error}</div> : null}
      <label className={labelClass}>
        Anchor name
        <input className={inputClass} name="apName" defaultValue={accessPoint?.apName ?? ""} placeholder="Packing Line 3" required />
      </label>
      <label className={labelClass}>
        Internal anchor code
        <input className={inputClass} name="apMac" defaultValue={accessPoint?.apMac ?? ""} placeholder="ANCHOR-PACK-03" required />
        <span className="text-xs font-normal text-slate-500">Use a unique code. This replaces the old AP/MAC-only workflow.</span>
      </label>
      <label className={labelClass}>
        Area
        <input className={inputClass} name="area" value={area} onChange={(event) => setArea(event.target.value)} placeholder="Packing" />
      </label>
      <label className={labelClass}>
        Department
        <input className={inputClass} name="department" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Outbound" />
      </label>
      <label className={labelClass}>
        Station / location
        <input className={inputClass} name="station" value={station} onChange={(event) => setStation(event.target.value)} placeholder="Line 3" />
      </label>
      <label className={labelClass}>
        Location label
        <input className={inputClass} name="locationLabel" value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="Packing Line 3" required />
      </label>
      <label className={`${labelClass} lg:col-span-2`}>
        Display path
        <input className={inputClass} name="displayPath" value={displayPath} onChange={(event) => setDisplayPath(event.target.value)} placeholder={suggestedPath} />
        <span className="text-xs font-normal text-slate-500">Leave blank to use: {suggestedPath}</span>
      </label>
      <label className={labelClass}>
        Floor name
        <input className={inputClass} name="floorName" defaultValue={accessPoint?.floorName ?? ""} placeholder={selectedMap?.floorName ?? "Floor 1"} />
      </label>
      <label className={labelClass}>
        Map
        <select className={inputClass} name="mapId" value={mapId} onChange={(event) => setMapId(event.target.value)}>
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
      <input type="hidden" name="mapName" value={selectedMap?.name ?? ""} />
      <input type="hidden" name="unifiDeviceId" value={accessPoint?.unifiDeviceId ?? ""} />
      <label className={labelClass}>
        X coordinate %
        <input className={inputClass} name="x" type="number" min="0" max="100" step="0.1" value={x} onChange={(event) => setX(event.target.value)} required />
      </label>
      <label className={labelClass}>
        Y coordinate %
        <input className={inputClass} name="y" type="number" min="0" max="100" step="0.1" value={y} onChange={(event) => setY(event.target.value)} required />
      </label>
      {selectedMap?.imageUrl ? (
        <div className="lg:col-span-2">
          <p className="mb-2 text-sm font-semibold text-slate-700">Tap the map to place the anchor</p>
          <button type="button" onClick={placeAnchor} className="relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedMap.imageUrl} alt={selectedMap.name} className="max-h-[28rem] w-full object-contain" />
            <span className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-slate-950 text-white shadow" style={{ left: `${x}%`, top: `${y}%` }}>
              <MapPin size={16} />
            </span>
          </button>
        </div>
      ) : null}
      <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
        <input className="size-4 rounded border-slate-300" name="active" type="checkbox" defaultChecked={accessPoint?.active ?? true} />
        Active location anchor
      </label>
      <label className={`${labelClass} lg:col-span-2`}>
        Notes
        <textarea className={inputClass} name="notes" rows={4} defaultValue={accessPoint?.notes ?? ""} />
      </label>
      <div className="lg:col-span-2">
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save location anchor"}
        </button>
      </div>
    </form>
  );
}
