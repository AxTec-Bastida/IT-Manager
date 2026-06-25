"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Check, X, Search, Database, AlertCircle } from "lucide-react";
import { actionButtonClass } from "@/components/ui-patterns";

type ControlledValue = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

const types = [
  { value: "ASSET_CATEGORY", label: "Asset Categories" },
  { value: "BRAND", label: "Brands" },
  { value: "MODEL", label: "Models" },
  { value: "AREA", label: "Areas" },
  { value: "DEPARTMENT", label: "Departments" },
  { value: "LOCATION", label: "Locations" },
  { value: "TAG", label: "Tags" },
  { value: "TASK_CATEGORY", label: "Task Categories" },
  { value: "STOCK_CATEGORY", label: "Stock Categories" },
  { value: "MAINTENANCE_PROFILE", label: "Maintenance Profiles" },
  { value: "PRINTER_CONSUMABLE_TYPE", label: "Printer Consumable Types" },
];

export function MasterDataManager({ initialValues }: { initialValues: ControlledValue[] }) {
  const [values, setValues] = useState<ControlledValue[]>(initialValues);
  const [selectedType, setSelectedType] = useState<string>("ASSET_CATEGORY");
  const [search, setSearch] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newDesc, setNewDesc] = useState<string>("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Fetch values when type changes
    async function fetchValues() {
      const res = await fetch(`/api/admin/master-data?type=${selectedType}`);
      if (res.ok) {
        const data = await res.json();
        setValues(data);
      }
    }
    fetchValues();
  }, [selectedType]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/master-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          name: newName,
          description: newDesc || null,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to create.");

      setValues((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewDesc("");
      setMessage({ text: "Controlled value created successfully.", type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "An error occurred", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/master-data/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update status.");

      setValues((prev) => prev.map((v) => (v.id === id ? { ...v, isActive: data.isActive } : v)));
      setMessage({ text: `Value ${data.isActive ? "reactivated" : "deactivated"} successfully.`, type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "An error occurred", type: "error" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this controlled value? This action can fail if the value is currently referenced by other records.")) return;
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/master-data/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to delete.");

      setValues((prev) => prev.filter((v) => v.id !== id));
      setMessage({ text: "Controlled value deleted successfully.", type: "success" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "An error occurred", type: "error" });
    }
  }

  const filteredValues = values.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Sidebar Controls */}
      <div className="space-y-6 lg:col-span-1">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Select controlled list</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none sm:min-h-11 sm:text-sm"
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">Search values</label>
            <div className="relative mt-1">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-12 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none sm:min-h-11 sm:text-sm"
              />
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
            <Plus size={18} />
            Add Controlled Value
          </h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Laptop, Receiving, HR..."
                className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none sm:min-h-11 sm:text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Description optional</span>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder="Context or notes"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none sm:text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className={`${actionButtonClass("primary")} w-full min-h-11`}
            >
              Add to list
            </button>
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
            {message.type === "error" && <AlertCircle className="shrink-0 size-5 text-rose-700" />}
            <div>
              <p className="font-semibold">{message.type === "success" ? "Operation succeeded" : "Validation error"}</p>
              <p className="mt-0.5">{message.text}</p>
            </div>
          </div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Database size={18} className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-950">
              {types.find((t) => t.value === selectedType)?.label} ({filteredValues.length})
            </h2>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {filteredValues.map((item) => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${item.isActive ? "text-slate-950" : "text-slate-400 line-through"}`}>
                      {item.name}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        item.isActive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item.id, item.isActive)}
                    className={`inline-flex size-9 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                      item.isActive
                        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                    title={item.isActive ? "Deactivate" : "Reactivate"}
                  >
                    {item.isActive ? <X size={15} /> : <Check size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                    title="Delete permanently"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {filteredValues.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No matching values found in this controlled list.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
