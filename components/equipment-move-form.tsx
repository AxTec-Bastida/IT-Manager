"use client";

import { useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle, MapPin, Network, RotateCcw, ScanLine, Truck } from "lucide-react";
import { isMoveNetworkRelevant, isMoveUsefulAsset } from "@/lib/equipment-move";
import { buildAnchorDisplayPath } from "@/lib/map-anchors";

type Device = {
  id: string;
  name: string;
  assetTag: string | null;
  serialNumber: string | null;
  category: string;
  status: string;
  condition: string;
  location: string | null;
  areaDepartment: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  vlan: number | null;
  usesStaticIp: boolean;
  isFixedAsset: boolean;
  employee?: { fullName: string } | null;
  activeAssignment?: string | null;
  activeLoan?: string | null;
  activeRma?: string | null;
  currentMapAnchorId?: string | null;
};

type Range = { id: string; name: string; category: string; vlan: number; startIp: string; endIp: string; location: string | null };
type Anchor = { id: string; apName: string; locationLabel: string; area: string | null; department: string | null; station: string | null; displayPath: string | null; mapName: string | null };
type MoveWarning = { type: string; severity: string; message: string; conflictingDeviceId?: string; conflictingDeviceName?: string; suggestedIp?: string | null };
type CheckResult = { warnings?: MoveWarning[]; expectedRange?: Range | null; suggestion?: { ip?: string | null; reason?: string } | null };

const locationChips = ["Operations", "Packing", "Shipping", "Returns", "Office", "IT", "Other"];

export function EquipmentMoveForm({ device, ranges, anchors = [] }: { device: Device; ranges: Range[]; anchors?: Anchor[] }) {
  const router = useRouter();
  const [area, setArea] = useState(firstArea(device.areaDepartment));
  const [department, setDepartment] = useState(secondArea(device.areaDepartment));
  const [location, setLocation] = useState(device.location ?? "");
  const [notes, setNotes] = useState("");
  const [mapAnchorId, setMapAnchorId] = useState(device.currentMapAnchorId ?? "");
  const [keepCurrentIp, setKeepCurrentIp] = useState(true);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [markActive, setMarkActive] = useState(false);
  const [warnings, setWarnings] = useState<MoveWarning[]>([]);
  const [expectedRange, setExpectedRange] = useState<Range | null>(null);
  const [suggestion, setSuggestion] = useState<CheckResult["suggestion"]>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const moveUseful = isMoveUsefulAsset(device);
  const networkRelevant = isMoveNetworkRelevant(device);
  const unusualStatus = ["LOANED_OUT", "IN_REPAIR_RMA", "LOST", "MISSING", "RETIRED", "DISPOSED"].includes(device.status);
  const currentLocation = [device.areaDepartment, device.location].filter(Boolean).join(" / ") || "No location";
  const newLocation = [area, department, location].filter(Boolean).join(" / ") || "No new location";
  const locationSuggestions = useMemo(() => [...new Set(ranges.map((range) => range.location).filter((value): value is string => Boolean(value)))].slice(0, 8), [ranges]);

  function payload(action: string) {
    return { action, area, department, location, notes, mapAnchorId, keepCurrentIp, confirmWarnings, markActive };
  }

  function chooseAnchor(anchorId: string) {
    setMapAnchorId(anchorId);
    const anchor = anchors.find((item) => item.id === anchorId);
    if (!anchor) return;
    setArea(anchor.area ?? "");
    setDepartment(anchor.department ?? "");
    setLocation(anchor.station || anchor.locationLabel);
  }

  async function submit(action = "check") {
    setLoading(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/devices/${device.id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(action)),
    });
    const data = await response.json();
    setLoading(false);
    setWarnings(data.warnings ?? []);
    setExpectedRange(data.expectedRange ?? null);
    setSuggestion(data.suggestion ?? null);
    if (!response.ok) {
      setError(data.error || "Could not move this asset.");
      return data;
    }
    setMessage(action === "move" ? "Move saved." : "Move check complete.");
    if (action === "move") {
      router.refresh();
      window.location.href = `/devices/${device.id}?moved=1`;
    }
    return data;
  }

  return (
    <div className="space-y-4">
      {!moveUseful ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">This asset is not normally moved as equipment placement.</p>
          <p className="mt-1">Use this flow only if you intentionally track where this asset physically lives.</p>
        </div>
      ) : null}

      <Step title="1. Confirm asset" icon={<ScanLine size={18} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Asset" value={device.name} />
          <Info label="Tag / Serial" value={[device.assetTag, device.serialNumber].filter(Boolean).join(" / ") || "No tag or serial"} />
          <Info label="Category / Status" value={`${device.category.replaceAll("_", " ")} / ${device.status.replaceAll("_", " ")}`} />
          <Info label="Current placement" value={currentLocation} />
          {networkRelevant ? <Info label="IP / MAC / VLAN" value={[device.ipAddress || "No IP", device.macAddress || "No MAC", device.vlan ? `VLAN ${device.vlan}` : "No VLAN"].join(" / ")} /> : null}
          <Info label="Assignment" value={device.employee?.fullName || device.activeAssignment || "Not assigned"} />
        </div>
        {(unusualStatus || device.activeLoan || device.activeRma) ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">Review before moving</p>
            <p>{device.activeLoan || device.activeRma || `Status is ${device.status.replaceAll("_", " ")}.`} This move will not change loan, RMA, assignment, lost, or retired state.</p>
          </div>
        ) : null}
      </Step>

      <Step title="2. Choose new location" icon={<MapPin size={18} />}>
        <div className="flex flex-wrap gap-2">
          {locationChips.map((chip) => (
            <button key={chip} type="button" onClick={() => { setArea(chip); if (chip !== "Other" && !location) setLocation(chip); }} className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              {chip}
            </button>
          ))}
        </div>
        {locationSuggestions.length ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {locationSuggestions.map((item) => (
              <button key={item} type="button" onClick={() => setLocation(item)} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Area" value={area} onChange={setArea} placeholder="Packing" />
          <Field label="Department" value={department} onChange={setDepartment} placeholder="Outbound" />
          <Field label="Station / location" value={location} onChange={setLocation} placeholder="Packing line 3" />
        </div>
        {anchors.length ? (
          <label className="mt-3 grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
            Map anchor
            <select value={mapAnchorId} onChange={(event) => chooseAnchor(event.target.value)} className="min-h-12 min-w-0 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm">
              <option value="">No map anchor</option>
              {anchors.map((anchor) => (
                <option key={anchor.id} value={anchor.id}>
                  {buildAnchorDisplayPath(anchor)}{anchor.mapName ? ` / ${anchor.mapName}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mt-3 grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
          Move notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 min-w-0 rounded-md border border-slate-300 px-3 py-2" placeholder="Moved from Returns to Packing line 3. Network kept unchanged." />
        </label>
      </Step>

      <Step title="3. Network impact check" icon={<Network size={18} />}>
        {networkRelevant ? (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Info label="Current network" value={[device.ipAddress || "No IP", device.macAddress || "No MAC", device.vlan ? `VLAN ${device.vlan}` : "No VLAN"].join(" / ")} />
              <Info label="Expected range" value={expectedRange ? `${expectedRange.name} / VLAN ${expectedRange.vlan}` : "Check move to suggest range"} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => submit("check")} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <CheckCircle size={16} />
                Check move
              </button>
              <Link href={`/devices/${device.id}/install`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-4 text-sm font-semibold text-cyan-900 hover:bg-cyan-100">
                <Network size={16} />
                Install / Commission
              </Link>
              <Toggle checked={keepCurrentIp} onChange={setKeepCurrentIp} label="Keep current IP" />
            </div>
            {suggestion?.ip ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <p className="font-semibold">Suggested IP if network changes: {suggestion.ip}</p>
                <p>{suggestion.reason}</p>
              </div>
            ) : null}
            <WarningList warnings={warnings} deviceId={device.id} />
          </>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <p className="font-semibold">No network change needed</p>
            <p>This asset is not treated as static/network equipment, so the move updates placement only.</p>
          </div>
        )}
      </Step>

      <Step title="4. Confirm move" icon={<Truck size={18} />}>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Info label="Previous placement" value={currentLocation} />
          <Info label="New placement" value={newLocation} />
          <Info label="Network status" value={networkRelevant ? (warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"} to review` : "No warnings from latest check") : "Placement only"} />
          <Info label="Status handling" value={markActive ? "Set active if currently available/reserved" : "Preserve current status"} />
        </div>
        {(warnings.some((warning) => warning.severity === "blocking") || unusualStatus) ? (
          <div className="mt-3">
            <Toggle checked={confirmWarnings} onChange={setConfirmWarnings} label="I reviewed warnings and this move is intentional" />
          </div>
        ) : null}
        {!unusualStatus && ["AVAILABLE", "RESERVED"].includes(device.status) && networkRelevant ? (
          <div className="mt-3">
            <Toggle checked={markActive} onChange={setMarkActive} label="Asset is now active/in operation" />
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
        <div className="sticky bottom-3 mt-4 grid gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-lg sm:static sm:flex sm:shadow-none">
          <button type="button" onClick={() => submit("move")} disabled={loading} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            <Truck size={18} />
            Confirm Move
          </button>
          <Link href={`/devices/${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-base font-semibold text-slate-700 hover:bg-slate-100">
            <RotateCcw size={18} />
            Back to asset
          </Link>
        </div>
      </Step>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">After move</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Link href={`/devices/${device.id}?photoType=LOCATION_INSTALLED#photos`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100"><Camera size={16} />Add location photo</Link>
          <Link href={`/devices/${device.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Open asset</Link>
          <Link href="/scan" className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Move another asset</Link>
          <Link href={`/devices/${device.id}/install`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-cyan-300 bg-cyan-50 px-3 font-semibold text-cyan-900 hover:bg-cyan-100">Review network</Link>
        </div>
      </section>
    </div>
  );
}

function WarningList({ warnings, deviceId }: { warnings: MoveWarning[]; deviceId: string }) {
  if (!warnings.length) return <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">No network/location warnings from the latest check.</p>;
  return (
    <div className="mt-3 grid gap-2">
      {warnings.map((warning) => (
        <div key={`${warning.type}-${warning.message}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">{warning.type.replaceAll("_", " ")} / {warning.severity}</p>
          <p>{warning.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {warning.conflictingDeviceId ? <Link className="inline-flex min-h-11 items-center font-semibold underline" href={`/devices/${warning.conflictingDeviceId}`}>Open conflicting asset</Link> : null}
            {warning.suggestedIp ? <Link className="inline-flex min-h-11 items-center font-semibold underline" href={`/devices/${deviceId}/install`}>Use suggested IP in Install / Commission</Link> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Step({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-4"><h2 className="flex items-center gap-2 font-semibold text-slate-950">{icon}{title}</h2><div className="mt-4">{children}</div></section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p></div>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-12 min-w-0 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" /></label>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function firstArea(value?: string | null) {
  return String(value ?? "").split("/")[0]?.trim() ?? "";
}

function secondArea(value?: string | null) {
  return String(value ?? "").split("/").slice(1).join("/").trim();
}
