"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { DeviceCategory, InventoryAuditScopeType } from "@prisma/client";
import { categoryLabels } from "@/lib/constants";
import { buildAnchorDisplayPath } from "@/lib/map-anchors";

const areaChips = ["Operations", "Packing", "Shipping", "Returns", "Office", "IT", "Other"];
const categoryChips: Array<{ label: string; value: DeviceCategory | "" }> = [
  { label: "All", value: "" },
  { label: "Laptops", value: "LAPTOP" },
  { label: "Mobile", value: "PHONE" },
  { label: "Printers", value: "THERMAL_PRINTER" },
  { label: "Scales", value: "SCALE" },
  { label: "Scanners", value: "SCANNER" },
  { label: "Network", value: "ACCESS_POINT" },
  { label: "Monitors", value: "MONITOR" },
  { label: "Other", value: "OTHER" },
];

type AuditAnchor = { id: string; locationLabel: string; area: string | null; department: string | null; station: string | null; displayPath: string | null };

export function AuditStartForm({ categories, anchors = [] }: { categories: DeviceCategory[]; anchors?: AuditAnchor[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scopeType, setScopeType] = useState<InventoryAuditScopeType>("AREA_LOCATION");
  const [title, setTitle] = useState("Physical inventory audit");
  const [area, setArea] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<DeviceCategory | "">("");
  const [includeLoaned, setIncludeLoaned] = useState(false);
  const [includeRepair, setIncludeRepair] = useState(false);
  const [includeMissingLost, setIncludeMissingLost] = useState(false);
  const [notes, setNotes] = useState("");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [error, setError] = useState("");

  const payload = useMemo(() => ({ title, scopeType, area, department, location, category, includeLoaned, includeRepair, includeMissingLost, notes }), [area, category, department, includeLoaned, includeMissingLost, includeRepair, location, notes, scopeType, title]);

  function chooseAnchor(anchorId: string) {
    const anchor = anchors.find((item) => item.id === anchorId);
    if (!anchor) return;
    setScopeType("AREA_LOCATION");
    setArea(anchor.area ?? "");
    setDepartment(anchor.department ?? "");
    setLocation(anchor.station || anchor.locationLabel);
  }

  async function submit(action: "estimate" | "start") {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "estimate" ? { ...payload, action: "estimate" } : payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not start audit.");
        return;
      }
      if (action === "estimate") {
        setEstimate(data.expectedCount);
        return;
      }
      router.push(data.redirectTo || "/audits");
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{error}</div> : null}
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Audit title
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
      </label>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-slate-700">Scope</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["AREA_LOCATION", "Area / Location"],
            ["CATEGORY", "Category"],
            ["AREA_CATEGORY", "Area + Category"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScopeType(value as InventoryAuditScopeType)}
              className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${scopeType === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Area
          <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Packing, Shipping, IT" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Department
          <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Operations" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Location / station
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Packing Line 1" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
        </label>
      </div>

      {anchors.length ? (
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Start from map anchor
          <select onChange={(event) => chooseAnchor(event.target.value)} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" defaultValue="">
            <option value="">Choose a location anchor</option>
            {anchors.map((anchor) => (
              <option key={anchor.id} value={anchor.id}>{buildAnchorDisplayPath(anchor)}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {areaChips.map((chip) => (
          <button key={chip} type="button" onClick={() => setArea(chip === "Other" ? "" : chip)} className="min-h-11 shrink-0 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
            {chip}
          </button>
        ))}
      </div>

      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value as DeviceCategory | "")} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm">
          <option value="">All categories</option>
          {categories.map((option) => (
            <option key={option} value={option}>{categoryLabels[option]}</option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categoryChips.map((chip) => (
          <button key={chip.label} type="button" onClick={() => setCategory(chip.value)} className="min-h-11 shrink-0 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
            {chip.label}
          </button>
        ))}
      </div>

      <details className="rounded-md border border-slate-200 bg-slate-50">
        <summary className="min-h-12 cursor-pointer px-3 py-3 text-sm font-semibold text-slate-700">Optional include/exclude settings</summary>
        <div className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-3">
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={includeLoaned} onChange={(event) => setIncludeLoaned(event.target.checked)} />
            Include loaned out
          </label>
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={includeRepair} onChange={(event) => setIncludeRepair(event.target.checked)} />
            Include repair/RMA
          </label>
          <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={includeMissingLost} onChange={(event) => setIncludeMissingLost(event.target.checked)} />
            Include missing/lost
          </label>
        </div>
      </details>

      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="rounded-md border border-slate-300 p-3 text-base sm:text-sm" />
      </label>

      {estimate != null ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-900">
          Estimated expected assets: {estimate.toLocaleString()}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={isPending} onClick={() => submit("estimate")} className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">
          Estimate expected count
        </button>
        <button type="button" disabled={isPending} onClick={() => submit("start")} className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">
          Start audit
        </button>
      </div>
    </div>
  );
}
