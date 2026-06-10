"use client";

import { useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle, Lightbulb, Network, Radar, RotateCcw, ScanLine } from "lucide-react";
import { isInstallEligibleAsset } from "@/lib/equipment-install";

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
};

type Range = { id: string; name: string; category: string; vlan: number; startIp: string; endIp: string; location: string | null };
type Conflict = { type: string; message: string; conflictingDeviceId?: string; conflictingDeviceName?: string; suggestedIp?: string | null };
type Suggestion = { ip?: string | null; reason?: string; rangeId?: string; rangeName?: string; vlan?: number };

const locationChips = ["Operations", "Packing", "Shipping", "Returns", "Office", "IT", "Other"];

export function EquipmentInstallForm({ device, ranges }: { device: Device; ranges: Range[] }) {
  const router = useRouter();
  const [location, setLocation] = useState(device.location ?? "");
  const [areaDepartment, setAreaDepartment] = useState(device.areaDepartment ?? "");
  const [ipAddress, setIpAddress] = useState(device.ipAddress ?? "");
  const [macAddress, setMacAddress] = useState(device.macAddress ?? "");
  const [vlan, setVlan] = useState(device.vlan ? String(device.vlan) : "");
  const [ipRangeId, setIpRangeId] = useState("");
  const [usesStaticIp, setUsesStaticIp] = useState(device.usesStaticIp);
  const [isFixedAsset, setIsFixedAsset] = useState(device.isFixedAsset);
  const [macAddressSource, setMacAddressSource] = useState(device.macAddress ? "IMPORTED" : "MANUAL");
  const [macAddressConfidence, setMacAddressConfidence] = useState(device.macAddress ? "CONFIRMED" : "MANUAL");
  const [notes, setNotes] = useState("");
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const eligible = isInstallEligibleAsset(device);
  const selectedRange = useMemo(() => ranges.find((range) => range.id === ipRangeId) ?? null, [ranges, ipRangeId]);

  function payload(action: string) {
    return { action, location, areaDepartment, ipAddress, macAddress, vlan, ipRangeId, usesStaticIp, isFixedAsset, macAddressSource, macAddressConfidence, notes, overrideConflict };
  }

  async function check(action = "check") {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/devices/${device.id}/install`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(action)),
    });
    const data = await response.json();
    setLoading(false);
    setConflicts(data.conflicts ?? []);
    setSuggestion(data.suggestion ?? null);
    if (!response.ok) {
      setError(data.error || "Could not check installation.");
      return data;
    }
    setMessage(action === "install" ? "Installation saved." : "IP/MAC check complete.");
    if (action === "install") {
      router.refresh();
      window.location.href = `/devices/${device.id}?installed=1`;
    }
    return data;
  }

  async function detectMac() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/devices/${device.id}/install/detect-mac`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ipAddress }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok || !data.ok) {
      setError(data.error || data.message || "Could not detect MAC.");
      return;
    }
    setMacAddress(data.macAddress);
    setMacAddressSource("ARP_DETECTED");
    setMacAddressConfidence("DETECTED");
    setMessage(data.message || "MAC detected.");
  }

  return (
    <div className="space-y-4">
      {!eligible ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Install action is hidden by default for this asset type.</p>
          <p className="mt-1">Mobile pools and non-static assets should stay inventory/assignment/RMA assets unless network tracking is intentionally enabled.</p>
        </div>
      ) : null}

      <Step title="1. Confirm asset" icon={<ScanLine size={18} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Asset" value={device.name} />
          <Info label="Tag / Serial" value={[device.assetTag, device.serialNumber].filter(Boolean).join(" / ") || "No tag or serial"} />
          <Info label="Category / Status" value={`${device.category.replaceAll("_", " ")} / ${device.status.replaceAll("_", " ")}`} />
          <Info label="Current IP / MAC" value={[device.ipAddress || "No IP", device.macAddress || "No MAC"].join(" / ")} />
          <Info label="Current location" value={device.location || device.areaDepartment || "No location"} />
          <Info label="Assignment" value={device.employee?.fullName || "Not assigned"} />
        </div>
      </Step>

      <Step title="2. Choose install area" icon={<Camera size={18} />}>
        <div className="flex flex-wrap gap-2">
          {locationChips.map((chip) => (
            <button key={chip} type="button" onClick={() => { setAreaDepartment(chip); if (chip !== "Other") setLocation(chip); }} className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Area / department" value={areaDepartment} onChange={setAreaDepartment} placeholder="Packing" />
          <Field label="Location / station" value={location} onChange={setLocation} placeholder="Packing line 3" />
        </div>
      </Step>

      <Step title="3. Network setup" icon={<Network size={18} />}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="IP address" value={ipAddress} onChange={setIpAddress} placeholder="192.168.163.45" inputMode="decimal" />
          <Field label="MAC address" value={macAddress} onChange={(value) => { setMacAddress(value); setMacAddressSource("MANUAL"); setMacAddressConfidence("MANUAL"); }} placeholder="AA:BB:CC:DD:EE:FF" />
          <Field label="VLAN" value={vlan} onChange={setVlan} placeholder="163" inputMode="numeric" />
          <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
            IP range
            <select value={ipRangeId} onChange={(event) => { setIpRangeId(event.target.value); const range = ranges.find((item) => item.id === event.target.value); if (range) setVlan(String(range.vlan)); }} className="min-h-12 min-w-0 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm">
              <option value="">Auto / choose range</option>
              {ranges.map((range) => <option key={range.id} value={range.id}>{range.name} / VLAN {range.vlan}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Toggle checked={usesStaticIp} onChange={setUsesStaticIp} label="Uses static IP" />
          <Toggle checked={isFixedAsset} onChange={setIsFixedAsset} label="Fixed/static asset" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
            MAC source
            <select value={macAddressSource} onChange={(event) => setMacAddressSource(event.target.value)} className="min-h-12 min-w-0 w-full rounded-md border border-slate-300 px-3">
              {["MANUAL", "ARP_DETECTED", "IMPORTED", "SCANNED", "UNKNOWN"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
            MAC confidence
            <select value={macAddressConfidence} onChange={(event) => setMacAddressConfidence(event.target.value)} className="min-h-12 min-w-0 w-full rounded-md border border-slate-300 px-3">
              {["CONFIRMED", "DETECTED", "MANUAL", "NEEDS_REVIEW"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </label>
        </div>
      </Step>

      <Step title="4. Check IP / MAC" icon={<Radar size={18} />}>
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => check("check")} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <CheckCircle size={16} />
            Check IP / MAC
          </button>
          <button type="button" onClick={() => check("check").then((data) => data?.suggestion?.ip ? setIpAddress(data.suggestion.ip) : null)} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Lightbulb size={16} />
            Suggest / use IP
          </button>
          <button type="button" onClick={detectMac} disabled={loading || !ipAddress} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Radar size={16} />
            Detect MAC
          </button>
        </div>
        {suggestion?.ip ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <p className="font-semibold">{suggestion.ip} suggested{suggestion.rangeName ? ` from ${suggestion.rangeName}` : ""}</p>
            <p>{suggestion.reason}</p>
          </div>
        ) : suggestion?.reason ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{suggestion.reason}</p> : null}
        {conflicts.length ? (
          <div className="mt-3 grid gap-2">
            {conflicts.map((conflict) => (
              <div key={`${conflict.type}-${conflict.message}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">{conflict.type.replaceAll("_", " ")}</p>
                <p>{conflict.message}</p>
                {conflict.conflictingDeviceId ? <Link className="mt-2 inline-flex min-h-11 items-center font-semibold underline" href={`/devices/${conflict.conflictingDeviceId}`}>Open conflicting asset</Link> : null}
                {conflict.suggestedIp ? <button type="button" onClick={() => setIpAddress(conflict.suggestedIp || "")} className="mt-2 inline-flex min-h-11 rounded-md bg-white px-3 font-semibold">Use {conflict.suggestedIp}</button> : null}
              </div>
            ))}
            <Toggle checked={overrideConflict} onChange={setOverrideConflict} label="I reviewed warnings and need to override" />
          </div>
        ) : null}
      </Step>

      <Step title="5. Confirm install" icon={<CheckCircle size={18} />}>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Info label="Location" value={[areaDepartment, location].filter(Boolean).join(" / ") || "No location"} />
          <Info label="IP / MAC" value={[ipAddress || "No IP", macAddress || "No MAC"].join(" / ")} />
          <Info label="VLAN / range" value={[vlan || selectedRange?.vlan || "No VLAN", selectedRange?.name || "Auto range"].join(" / ")} />
          <Info label="Flags" value={[usesStaticIp ? "Static IP" : "No static flag", isFixedAsset ? "Fixed asset" : "Not fixed"].join(" / ")} />
        </div>
        <label className="mt-3 grid gap-1 text-sm font-semibold text-slate-700">
          Install notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 rounded-md border border-slate-300 px-3 py-2" placeholder="Installed in Packing line 3. MAC verified from label." />
        </label>
        {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        {message ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
        <div className="sticky bottom-3 mt-4 grid gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-lg sm:static sm:flex sm:shadow-none">
          <button type="button" onClick={() => check("install")} disabled={loading || !eligible} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            <CheckCircle size={18} />
            Confirm Installation
          </button>
          <Link href={`/devices/${device.id}`} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-base font-semibold text-slate-700 hover:bg-slate-100">
            <RotateCcw size={18} />
            Back to asset
          </Link>
        </div>
      </Step>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">After install</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link href={`/devices/${device.id}?photoType=LOCATION_INSTALLED#photos`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Add location photo</Link>
          <Link href={`/labels?mode=existing&deviceId=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Generate label</Link>
          <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-100">Quick Scan</Link>
        </div>
      </section>
    </div>
  );
}

function Step({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="flex items-center gap-2 font-semibold text-slate-950">{icon}{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p></div>;
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="min-h-12 min-w-0 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" /></label>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
