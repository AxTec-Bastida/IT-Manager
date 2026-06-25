"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import type { Device, RmaCase } from "@prisma/client";
import { Save, Search, Trash2, AlertTriangle, Check } from "lucide-react";
import { categoryLabels } from "@/lib/constants";

type DeviceOption = Pick<
  Device,
  "id" | "name" | "assetTag" | "serialNumber" | "model" | "category" | "status" | "assignedTo" | "employeeId"
> & {
  employee?: { fullName: string } | null;
};

type RmaItemWithDevice = {
  deviceId: string;
  issueDescription: string | null;
  conditionSent: string | null;
  accessoriesSent: string | null;
  device?: DeviceOption | null;
};

export function RmaForm({
  rma,
  devices,
  initialDeviceIds = [],
}: {
  rma?: (RmaCase & { items: RmaItemWithDevice[] }) | null;
  devices: DeviceOption[];
  initialDeviceIds?: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (rma) {
      return new Set(rma.items.map((item) => item.deviceId));
    }
    return new Set(initialDeviceIds);
  });

  // Selected device details
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<DeviceOption[]>(() => {
    if (rma) {
      return rma.items
        .map((item) => item.device || devices.find((d) => d.id === item.deviceId))
        .filter((d): d is DeviceOption => !!d);
    }
    if (initialDeviceIds) {
      return initialDeviceIds
        .map((id) => devices.find((d) => d.id === id))
        .filter((d): d is DeviceOption => !!d);
    }
    return [];
  });

  // Metadata per selected device
  const [damageNotes, setDamageNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (rma) {
      rma.items.forEach((item) => {
        initial[item.deviceId] = item.issueDescription || "";
      });
    }
    return initial;
  });

  const [photoStatus, setPhotoStatus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (rma) {
      rma.items.forEach((item) => {
        initial[item.deviceId] = item.conditionSent === "Photo Attached";
      });
    }
    return initial;
  });

  const [scanInput, setScanInput] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-slate-950 focus:outline-none";
  const labelClass = "space-y-1 text-xs font-semibold text-slate-700";

  // Category filter with case/spacing-safe comparison
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const selectedCategoryUpper = category ? category.toUpperCase().trim() : "";

    return devices
      .filter((device) => {
        const devCategory = (device.category || "").toString().toUpperCase().trim();
        const devCategoryLabel = categoryLabels[device.category as keyof typeof categoryLabels]?.toUpperCase().trim() || "";

        let categoryMatches = true;
        if (selectedCategoryUpper) {
          categoryMatches = devCategory === selectedCategoryUpper || devCategoryLabel === selectedCategoryUpper;
        }

        const haystack = `${device.name} ${device.assetTag ?? ""} ${device.serialNumber ?? ""} ${device.model ?? ""} ${device.assignedTo ?? ""} ${device.employee?.fullName ?? ""}`.toLowerCase();
        return (!text || haystack.includes(text)) && categoryMatches;
      })
      .slice(0, 40);
  }, [devices, query, category]);

  function addDevice(device: DeviceOption) {
    if (selected.has(device.id)) {
      setScanError("Device already added to this RMA.");
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(device.id);
      return next;
    });
    setSelectedDeviceDetails((prev) => {
      if (prev.some((d) => d.id === device.id)) return prev;
      return [...prev, device];
    });
    setScanError(null);
  }

  function removeDevice(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedDeviceDetails((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleScanLookup(value: string) {
    const q = value.trim();
    if (!q) return;
    setScanError(null);

    const local = devices.find(
      (d) =>
        d.assetTag?.toLowerCase() === q.toLowerCase() ||
        d.serialNumber?.toLowerCase() === q.toLowerCase()
    );
    if (local) {
      addDevice(local);
      setScanInput("");
      return;
    }

    try {
      const res = await fetch("/api/scan-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: q }),
      });
      if (!res.ok) {
        setScanError("Failed to lookup device.");
        return;
      }
      const data = await res.json();
      if (data.devices && data.devices.length > 0) {
        addDevice(data.devices[0]);
        setScanInput("");
      } else {
        setScanError(`Device "${q}" not found in inventory.`);
      }
    } catch {
      setScanError("Error connecting to server.");
    }
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(null);

    const devicesPayload = selectedDeviceDetails.map((device) => ({
      deviceId: device.id,
      issueDescription: damageNotes[device.id] || null,
      conditionSent: photoStatus[device.id] ? "Photo Attached" : "Needs Photo",
      accessoriesSent: "Standard",
    }));

    const payload = {
      ...Object.fromEntries(formData.entries()),
      deviceIds: selectedDeviceDetails.map((d) => d.id),
      devices: devicesPayload,
    };

    const response = await fetch(rma ? `/api/rma/${rma.id}` : "/api/rma", {
      method: rma ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save RMA.");
      return;
    }
    router.push(`/rma/${data.rma.id}`);
    router.refresh();
  }

  const assignedSelected = selectedDeviceDetails.filter((device) => device.assignedTo || device.employee);

  return (
    <form action={submit} className="space-y-6 max-w-xl mx-auto px-4 sm:px-0">
      {message ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="shrink-0 text-rose-600" size={18} />
          <div>
            <p className="font-semibold">Submit Error</p>
            <p className="mt-1">{message}</p>
          </div>
        </div>
      ) : null}

      {/* 1. RMA DETAILS */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-base text-slate-950">1. RMA Details</h2>
          <p className="text-xs text-slate-500 mt-0.5">Metadata can be filled later for drafts.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            RMA number *
            <input className={inputClass} name="rmaNumber" defaultValue={rma?.rmaNumber ?? ""} required placeholder="RMA-12345" />
          </label>
          <label className={labelClass}>
            Status
            <select className={inputClass} name="status" defaultValue={rma?.status ?? "DRAFT"}>
              {["DRAFT", "SENT", "ACTIVE", "PARTIALLY_RETURNED", "RETURNED", "CLOSED", "CANCELLED"].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Title / Name
            <input className={inputClass} name="title" defaultValue={rma?.title ?? ""} placeholder="iPod Repair Batch" />
          </label>
          <label className={labelClass}>
            Destination
            <input className={inputClass} name="destination" defaultValue={rma?.destination ?? ""} placeholder="USA Repair Center" />
          </label>
          <label className={labelClass}>
            Vendor Name
            <input className={inputClass} name="vendorName" defaultValue={rma?.vendorName ?? ""} placeholder="Vendor Co" />
          </label>
          <label className={labelClass}>
            Contact Name
            <input className={inputClass} name="contactName" defaultValue={rma?.contactName ?? ""} placeholder="John Doe" />
          </label>
          <label className={labelClass}>
            Contact Email
            <input className={inputClass} name="contactEmail" type="email" defaultValue={rma?.contactEmail ?? ""} placeholder="john@vendor.com" />
          </label>
          <label className={labelClass}>
            Carrier
            <input className={inputClass} name="carrier" defaultValue={rma?.carrier ?? ""} placeholder="FedEx" />
          </label>
          <label className={labelClass}>
            Tracking number
            <input className={inputClass} name="trackingNumber" defaultValue={rma?.trackingNumber ?? ""} placeholder="1Z999AA10123456784" />
          </label>
          <label className={labelClass}>
            Sent date
            <input className={inputClass} name="sentAt" type="date" defaultValue={dateValue(rma?.sentAt)} />
          </label>
          <label className={labelClass}>
            Reminder after days
            <input className={inputClass} name="reminderAfterDays" type="number" min="1" defaultValue={rma?.reminderAfterDays ?? 7} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={2} defaultValue={rma?.notes ?? ""} />
          </label>
        </div>
      </section>

      {/* 2. SELECT DEVICES */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-base text-slate-950">2. Select devices</h2>
          <p className="text-xs text-slate-500 mt-0.5">Scan asset tag or serial. Or search manually.</p>
        </div>

        {/* Scan Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Scan Device Tag or Serial..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScanLookup(scanInput);
                }
              }}
              className="w-full min-h-11 rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleScanLookup(scanInput)}
            className="px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-sm font-medium transition-colors"
          >
            Add
          </button>
        </div>

        {scanError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="shrink-0 text-rose-700 mt-0.5" size={14} />
            <span>{scanError}</span>
          </div>
        )}

        {/* Manual search fallback */}
        <div className="text-center text-xs text-slate-400 font-medium">— OR —</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <label className={labelClass}>
            Search assets
            <input
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Asset tag, serial, model..."
            />
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
          {filtered.length > 0 ? (
            filtered.map((device) => {
              const isSelected = selected.has(device.id);
              return (
                <div key={device.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-white transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{device.name}</p>
                    <p className="text-slate-500 mt-0.5">
                      Tag: {device.assetTag || "-"} / SN: {device.serialNumber || "-"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSelected) removeDevice(device.id);
                      else addDevice(device);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                      isSelected
                        ? "bg-slate-900 border-slate-950 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {isSelected ? <Check size={12} /> : null}
                    {isSelected ? "Selected" : "Select"}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs">No assets match your search.</div>
          )}
        </div>
      </section>

      {/* 3. REVIEW SELECTED DEVICES */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-base text-slate-950">3. Selected devices for RMA</h2>
          <p className="text-xs text-slate-500 mt-0.5">Detail damage notes and photo status.</p>
        </div>

        {assignedSelected.length ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="shrink-0 text-amber-700 mt-0.5" size={14} />
            <span>
              {assignedSelected.length} selected asset{assignedSelected.length === 1 ? " is" : "s are"}{" "}
              currently assigned. Sending to RMA makes them unavailable, but assignment history is preserved.
            </span>
          </div>
        ) : null}

        <div className="space-y-3">
          {selectedDeviceDetails.length > 0 ? (
            selectedDeviceDetails.map((device) => (
              <div key={device.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{device.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {device.assetTag || "No tag"} / {device.serialNumber || "No serial"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDevice(device.id)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Damage / Issue Note
                    <input
                      type="text"
                      className="mt-1 w-full min-h-9 border border-slate-300 rounded-lg px-2 text-xs focus:outline-none"
                      placeholder="Screen broken, will not power on..."
                      value={damageNotes[device.id] ?? ""}
                      onChange={(e) => setDamageNotes({ ...damageNotes, [device.id]: e.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 select-none cursor-pointer sm:pt-4">
                    <input
                      type="checkbox"
                      checked={photoStatus[device.id] ?? false}
                      onChange={(e) => setPhotoStatus({ ...photoStatus, [device.id]: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    Damage Photo Attached
                  </label>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-sm text-slate-500">
              No devices selected. Scan or search above.
            </div>
          )}
        </div>
      </section>

      <button
        className="sticky bottom-6 w-full min-h-14 rounded-lg bg-slate-950 px-4 text-base font-semibold text-white shadow-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 z-10 disabled:opacity-60"
        disabled={saving || selectedDeviceDetails.length === 0}
      >
        <Save size={18} />
        {saving ? "Saving..." : rma ? "Save RMA Case" : "Create RMA Case"}
      </button>
    </form>
  );
}

function dateValue(value?: Date | string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
