"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, MapPin, RotateCcw, Truck } from "lucide-react";
import { enqueueOfflineAction } from "@/lib/offline-queue";
import { OfflineStatusIndicator } from "@/components/offline-status-indicator";
import { buildAnchorDisplayPath } from "@/lib/map-anchors";

type Anchor = {
  id: string;
  locationLabel: string;
  area: string | null;
  department: string | null;
  station: string | null;
  displayPath: string | null;
  mapName: string | null;
};

type InitialAsset = {
  deviceId?: string | null;
  assetTag?: string | null;
  name?: string | null;
  status?: string | null;
  location?: string | null;
  areaDepartment?: string | null;
  currentMapAnchorId?: string | null;
  activeAssignmentId?: string | null;
};

const areaChips = ["Packing", "Shipping", "Returns", "Receiving", "Office", "IT", "Other"];

export function OfflineMoveForm({ initialAsset, anchors, userId, appVersion }: { initialAsset?: InitialAsset | null; anchors: Anchor[]; userId: string; appVersion: string }) {
  const [assetTag, setAssetTag] = useState(initialAsset?.assetTag ?? "");
  const [deviceId] = useState(initialAsset?.deviceId ?? "");
  const [area, setArea] = useState(firstArea(initialAsset?.areaDepartment));
  const [department, setDepartment] = useState(secondArea(initialAsset?.areaDepartment));
  const [station, setStation] = useState("");
  const [locationLabel, setLocationLabel] = useState(initialAsset?.location ?? "");
  const [targetMapAnchorId, setTargetMapAnchorId] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function chooseAnchor(anchorId: string) {
    setTargetMapAnchorId(anchorId);
    const anchor = anchors.find((item) => item.id === anchorId);
    if (!anchor) return;
    setArea(anchor.area ?? "");
    setDepartment(anchor.department ?? "");
    setStation(anchor.station ?? "");
    setLocationLabel(anchor.locationLabel);
  }

  function queueMove() {
    setError(null);
    setMessage(null);
    try {
      const action = enqueueOfflineAction({
        actionType: "MOVE_ASSET",
        payload: {
          deviceId: deviceId || undefined,
          assetTag,
          targetMapAnchorId: targetMapAnchorId || undefined,
          targetLocationLabel: locationLabel,
          targetArea: area,
          targetDepartment: department,
          targetStation: station,
          notes,
          movedAtClient: new Date().toISOString(),
          lastKnownDeviceStatus: initialAsset?.status || undefined,
          lastKnownAssignmentId: initialAsset?.activeAssignmentId ?? null,
          lastKnownMapAnchorId: initialAsset?.currentMapAnchorId ?? null,
          clientRoute: window.location.pathname,
        },
        userId,
        appVersion,
      });
      setMessage(`Queued offline move ${action.clientActionId}. Sync it from the Offline Queue when online.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue offline move.");
    }
  }

  const destination = [area, department, station || locationLabel].filter(Boolean).join(" / ");

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Offline move queue</p>
            <p className="mt-1 text-sm">This saves only a small move request in this browser. The server validates permission, asset state, and destination when you sync.</p>
          </div>
          <OfflineStatusIndicator />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-950"><Truck size={18} />1. Confirm asset</h2>
        {initialAsset?.name ? <p className="mt-2 text-sm text-slate-600">{initialAsset.name}</p> : null}
        <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
          Asset tag
          <input value={assetTag} onChange={(event) => setAssetTag(event.target.value)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base" placeholder="GHT-LP-001" />
        </label>
        {initialAsset ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Current status" value={initialAsset.status?.replaceAll("_", " ") || "Unknown"} />
            <Info label="Current location" value={[initialAsset.areaDepartment, initialAsset.location].filter(Boolean).join(" / ") || "No current location"} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">When offline, type or scan the asset tag from the label. Server lookup happens later during sync.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-950"><MapPin size={18} />2. Choose destination</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {areaChips.map((chip) => (
            <button key={chip} type="button" onClick={() => setArea(chip)} className="min-h-11 shrink-0 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Area" value={area} onChange={setArea} placeholder="Packing" />
          <Field label="Department" value={department} onChange={setDepartment} placeholder="Outbound" />
          <Field label="Station" value={station} onChange={setStation} placeholder="Line 3" />
        </div>
        <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
          Location label
          <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base" placeholder="Packing line 3" />
        </label>
        {anchors.length ? (
          <label className="mt-3 grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
            Map/location anchor
            <select value={targetMapAnchorId} onChange={(event) => chooseAnchor(event.target.value)} className="min-h-12 min-w-0 rounded-md border border-slate-300 px-3 text-base">
              <option value="">No map anchor</option>
              {anchors.map((anchor) => (
                <option key={anchor.id} value={anchor.id}>
                  {buildAnchorDisplayPath(anchor)}{anchor.mapName ? ` / ${anchor.mapName}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="rounded-md border border-slate-300 px-3 py-2" placeholder="Optional: moved by warehouse IT during offline walkthrough." />
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-950"><CheckCircle2 size={18} />3. Queue move</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <Info label="Asset" value={assetTag || deviceId || "No asset selected"} />
          <Info label="Destination" value={destination || targetMapAnchorId || "No destination selected"} />
        </div>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This does not move the asset yet. Sync will apply it only if the asset, destination, permission, and last-known state are still safe.</p>
        {message ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p> : null}
        <div className="sticky bottom-3 mt-4 grid gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-lg sm:static sm:grid-cols-2 sm:shadow-none">
          <button type="button" onClick={queueMove} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white">
            <Truck size={18} />
            Queue offline move
          </button>
          <Link href="/offline" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-base font-semibold text-slate-700">
            <RotateCcw size={18} />
            Open queue
          </Link>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-1 break-words font-semibold text-slate-950">{value}</p></div>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-12 min-w-0 rounded-md border border-slate-300 px-3 text-base" /></label>;
}

function firstArea(value?: string | null) {
  return String(value ?? "").split("/")[0]?.trim() ?? "";
}

function secondArea(value?: string | null) {
  return String(value ?? "").split("/").slice(1).join("/").trim();
}
