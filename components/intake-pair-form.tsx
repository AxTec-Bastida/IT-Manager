"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, Search, X } from "lucide-react";

type DeviceResult = {
  id: string;
  assetTag: string | null;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
};

export function IntakePairForm() {
  const [device1, setDevice1] = useState<DeviceResult | null>(null);
  const [device2, setDevice2] = useState<DeviceResult | null>(null);
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");
  const [results1, setResults1] = useState<DeviceResult[]>([]);
  const [results2, setResults2] = useState<DeviceResult[]>([]);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function searchDevices(query: string, setResults: (r: DeviceResult[]) => void, setLoading: (v: boolean) => void) {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/devices?search=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.devices ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onPair() {
    if (!device1 || !device2) return;
    setSaving(true);
    setError(null);
    setWarnings([]);
    setSuccess(null);
    try {
      const res = await fetch("/api/intake/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: device1.id, targetId: device2.id, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create pair.");
      setWarnings(data.warnings ?? []);
      setSuccess(`Devices paired successfully.`);
      setDevice1(null);
      setDevice2(null);
      setSearch1("");
      setSearch2("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create pair.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Error</p>
          <p className="mt-1">{error}</p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <p className="font-semibold">Pairing warnings</p>
          </div>
          <ul className="mt-2 list-disc pl-4 space-y-1">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} />
            <p className="font-semibold">{success}</p>
          </div>
          <p className="mt-2">You can pair another set of devices below, or return to the <a href="/intake" className="underline">Intake hub</a>.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <DeviceSelector
          label="Device 1 — iPod or iPhone"
          hint="Search by asset tag, name, or serial number."
          selected={device1}
          onSelect={setDevice1}
          onClear={() => { setDevice1(null); setSearch1(""); setResults1([]); }}
          search={search1}
          onSearch={(q) => { setSearch1(q); searchDevices(q, setResults1, setLoading1); }}
          results={results1}
          loading={loading1}
        />
        <DeviceSelector
          label="Device 2 — Sled"
          hint="Search by asset tag, name, or serial number."
          selected={device2}
          onSelect={setDevice2}
          onClear={() => { setDevice2(null); setSearch2(""); setResults2([]); }}
          search={search2}
          onSearch={(q) => { setSearch2(q); searchDevices(q, setResults2, setLoading2); }}
          results={results2}
          loading={loading2}
        />
      </div>

      {device1 && device2 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <h3 className="font-semibold text-slate-950">Confirm pair</h3>
          <p className="text-sm text-slate-600">
            <strong>{device1.assetTag ?? device1.name}</strong> will be paired with <strong>{device2.assetTag ?? device2.name}</strong>.
            If either device is already paired, the existing pair will be replaced.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paired at Co-Production intake"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-950 focus:outline-none"
            />
          </div>
          <button
            onClick={onPair}
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-slate-950 px-6 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Pairing…" : "Confirm pair"}
          </button>
        </div>
      )}
    </div>
  );
}

function DeviceSelector({
  label, hint, selected, onSelect, onClear, search, onSearch, results, loading,
}: {
  label: string;
  hint: string;
  selected: DeviceResult | null;
  onSelect: (d: DeviceResult) => void;
  onClear: () => void;
  search: string;
  onSearch: (q: string) => void;
  results: DeviceResult[];
  loading: boolean;
}) {
  if (selected) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-green-700">{label}</p>
            <p className="mt-1 font-semibold text-slate-950">{selected.assetTag ?? selected.name}</p>
            <p className="text-sm text-slate-600">{selected.name}</p>
            {selected.serialNumber && <p className="text-xs text-slate-500">SN: {selected.serialNumber}</p>}
            <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{selected.category}</span>
          </div>
          <button onClick={onClear} className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Asset tag, name, or serial…"
          className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-slate-950 focus:outline-none"
        />
      </div>
      {loading && <p className="text-xs text-slate-500">Searching…</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
          {results.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => onSelect(d)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <p className="text-sm font-medium text-slate-900">{d.assetTag ?? d.name}</p>
                <p className="text-xs text-slate-500">{d.name} · {d.category}{d.serialNumber ? ` · SN: ${d.serialNumber}` : ""}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && search.length >= 2 && results.length === 0 && (
        <p className="text-xs text-slate-500">No devices found. Try a different search.</p>
      )}
    </div>
  );
}
