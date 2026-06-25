"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X, ShieldAlert, Network, Edit2, Save } from "lucide-react";
import type { DeviceCategory, IpRange } from "@prisma/client";
import { categoryLabels, categoryOptions } from "@/lib/constants";
import { actionButtonClass } from "@/components/ui-patterns";

type IpRangeWithCount = IpRange & {
  _count?: {
    devices: number;
  };
  devices?: unknown[];
};

export function IpRangeManager({ initialRanges }: { initialRanges: IpRangeWithCount[] }) {
  const [ranges, setRanges] = useState<IpRangeWithCount[]>(initialRanges);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DeviceCategory>("OTHER");
  const [vlan, setVlan] = useState(10);
  const [subnet, setSubnet] = useState("");
  const [startIp, setStartIp] = useState("");
  const [endIp, setEndIp] = useState("");
  const [location, setLocation] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass = "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none sm:text-sm";
  const labelClass = "block text-sm font-semibold text-slate-700 space-y-1";

  function startEdit(range: IpRangeWithCount) {
    setEditingId(range.id);
    setName(range.name);
    setCategory(range.category);
    setVlan(range.vlan);
    setSubnet(range.subnet || "");
    setStartIp(range.startIp);
    setEndIp(range.endIp);
    setLocation(range.location || "");
    setActive(range.active);
    setNotes(range.notes || "");
    setMessage(null);
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setCategory("OTHER");
    setVlan(10);
    setSubnet("");
    setStartIp("");
    setEndIp("");
    setLocation("");
    setActive(true);
    setNotes("");
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const payload = {
      name,
      category,
      vlan: Number(vlan),
      subnet: subnet || null,
      startIp,
      endIp,
      location: location || null,
      active,
      notes: notes || null,
    };

    try {
      const url = editingId ? `/api/ranges/${editingId}` : "/api/ranges";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save IP range.");

      if (editingId) {
        setRanges((prev) =>
          prev.map((r) => (r.id === editingId ? { ...r, ...data.range } : r))
        );
        setMessage({ text: "IP range updated successfully.", type: "success" });
      } else {
        setRanges((prev) => [...prev, data.range]);
        setMessage({ text: "IP range created successfully.", type: "success" });
      }
      clearForm();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "An error occurred", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(range: IpRangeWithCount) {
    setMessage(null);
    try {
      const res = await fetch(`/api/ranges/${range.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: range.name,
          category: range.category,
          vlan: range.vlan,
          subnet: range.subnet,
          startIp: range.startIp,
          endIp: range.endIp,
          location: range.location,
          notes: range.notes,
          active: !range.active,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update status.");

      setRanges((prev) =>
        prev.map((r) => (r.id === range.id ? { ...r, active: data.range.active } : r))
      );
      setMessage({ text: `IP Range "${range.name}" ${data.range.active ? "activated" : "deactivated"} successfully.`, type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "An error occurred", type: "error" });
    }
  }

  async function handleDelete(range: IpRangeWithCount) {
    const devicesCount = range._count?.devices ?? range.devices?.length ?? 0;
    if (devicesCount > 0) {
      setMessage({
        text: `Cannot delete range: This range is used by ${devicesCount} registered devices. Deactivate it instead.`,
        type: "error",
      });
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete IP range "${range.name}"?`)) {
      return;
    }

    setMessage(null);
    try {
      const res = await fetch(`/api/ranges/${range.id}?hard=true`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete IP range.");

      setRanges((prev) => prev.filter((r) => r.id !== range.id));
      setMessage({ text: "IP range permanently deleted.", type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "An error occurred", type: "error" });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Sidebar form */}
      <div className="lg:col-span-1 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
            <Plus size={18} />
            {editingId ? "Edit IP Range" : "Add IP Range"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <label className={labelClass}>
              <span>Range Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. IT Cage Printer Subnet"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DeviceCategory)}
                className={inputClass}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {categoryLabels[opt] || opt}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              <span>VLAN ID</span>
              <input
                type="number"
                required
                min={1}
                max={4094}
                value={vlan}
                onChange={(e) => setVlan(Number(e.target.value))}
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>Subnet Label (CIDR)</span>
              <input
                type="text"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                placeholder="e.g. 192.168.163.0/24"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>Start IP</span>
              <input
                type="text"
                required
                value={startIp}
                onChange={(e) => setStartIp(e.target.value)}
                placeholder="e.g. 192.168.163.1"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>End IP</span>
              <input
                type="text"
                required
                value={endIp}
                onChange={(e) => setEndIp(e.target.value)}
                placeholder="e.g. 192.168.163.254"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>Location / Area</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. IT Cage"
                className={inputClass}
              />
            </label>

            <label className="flex items-center gap-2 pt-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              Active IP pool
            </label>

            <label className={labelClass}>
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any routing details or descriptions..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none sm:text-sm"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className={`${actionButtonClass("primary")} flex-1 min-h-11`}
              >
                <Save size={16} className="mr-1" />
                {editingId ? "Save Changes" : "Add Range"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-lg border border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      </div>

      {/* Main List Display */}
      <div className="lg:col-span-2 space-y-4">
        {message ? (
          <div
            className={`rounded-lg border p-4 text-sm flex gap-3 items-start ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-rose-200 bg-rose-50 text-rose-950"
            }`}
          >
            {message.type === "error" && <ShieldAlert className="shrink-0 size-5 text-rose-700" />}
            <div>
              <p className="font-semibold">{message.type === "success" ? "Success" : "Error"}</p>
              <p className="mt-0.5">{message.text}</p>
            </div>
          </div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Network size={18} className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-950">
              Configured IP Ranges ({ranges.length})
            </h2>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {ranges.map((item) => {
              const devicesCount = item._count?.devices ?? item.devices?.length ?? 0;
              return (
                <div key={item.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-semibold text-base ${item.active ? "text-slate-950" : "text-slate-400 line-through"}`}>
                        {item.name}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          item.active
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {item.active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs rounded bg-slate-100 border border-slate-200 px-2 py-0.5 font-semibold text-slate-700">
                        VLAN {item.vlan}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Category: <span className="font-semibold text-slate-800">{categoryLabels[item.category] || item.category}</span>
                      {item.location ? ` • Location: ${item.location}` : ""}
                    </p>
                    <p className="font-mono text-sm text-slate-900 bg-slate-50 px-2 py-1 rounded inline-block">
                      {item.startIp} - {item.endIp} {item.subnet ? `(${item.subnet})` : ""}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-slate-500 italic mt-1">{item.notes}</p>
                    )}
                    <p className="text-xs text-slate-500 font-medium">
                      Devices currently assigned: <span className="font-bold text-slate-800">{devicesCount}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
                      title="Edit range details"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className={`inline-flex size-9 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                        item.active
                          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                      title={item.active ? "Deactivate" : "Reactivate"}
                    >
                      {item.active ? <X size={15} /> : <Check size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                      title="Delete permanently"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {ranges.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No IP ranges configured. Add your first range in the sidebar.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
