"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Device, Employee } from "@prisma/client";
import { ClipboardCheck, Search } from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";
import { categoryLabels, conditionLabels, statusLabels } from "@/lib/constants";

export function AssignmentForm({ employees, assets }: { employees: Employee[]; assets: Device[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(searchParams.get("assetId") ? [searchParams.get("assetId")!] : []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredAssets = useMemo(() => {
    const q = query.toLowerCase();
    return assets.filter((asset) =>
      !q || [asset.assetTag, asset.name, asset.serialNumber, asset.macAddress, asset.ipAddress, asset.model]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q)),
    );
  }, [assets, query]);

  function toggleAsset(id: string) {
    setSelectedAssetIds((current) => (current.includes(id) ? current.filter((assetId) => assetId !== id) : [...current, id]));
  }

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      termsAccepted: formData.get("termsAccepted") === "on",
      assetIds: selectedAssetIds,
    };
    const response = await fetch("/api/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to create assignment.");
      return;
    }
    router.push(`/assignments/${data.assignment.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">1. Employee</h2>
        <select name="employeeId" defaultValue={searchParams.get("employeeId") ?? ""} className="mt-3 min-h-14 w-full rounded-md border border-slate-300 px-3 text-base sm:min-h-12 sm:text-sm" required>
          <option value="">Select employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} {employee.employeeId ? `(${employee.employeeId})` : ""}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">2. Assets</h2>
        <label className="relative mt-3 block">
          <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search asset tag, serial, name, IP, MAC, model" className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm" />
        </label>
        <div className="mt-3 grid max-h-96 gap-2 overflow-auto">
          {filteredAssets.map((asset) => {
            const selected = selectedAssetIds.includes(asset.id);
            return (
              <button
                type="button"
                key={asset.id}
                onClick={() => toggleAsset(asset.id)}
                className={`min-h-20 rounded-md border p-3 text-left text-sm ${selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{asset.name}</p>
                    <p>{asset.assetTag || asset.serialNumber || asset.ipAddress || "No tag"}</p>
                  </div>
                  <span>{statusLabels[asset.status]}</span>
                </div>
                <p className="mt-1 text-xs opacity-80">{categoryLabels[asset.category]} • {conditionLabels[asset.condition]}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-slate-500">{selectedAssetIds.length} selected</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">3. Terms and signature</h2>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Assigned by
          <input name="assignedBy" className="mt-1 min-h-14 w-full rounded-md border border-slate-300 px-3 text-base sm:min-h-12 sm:text-sm" placeholder="IT technician name" />
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Terms
          <textarea name="termsText" rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm" defaultValue="I acknowledge receipt of this equipment and accept responsibility for returning it in good condition when requested." />
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input name="termsAccepted" type="checkbox" className="mt-1 size-4" required />
          Employee accepted the responsibility terms.
        </label>
        <div className="mt-3">
          <SignaturePad />
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-700">
          Notes
          <textarea name="notes" rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm" />
        </label>
      </section>

      <button className="sticky bottom-24 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white shadow-lg hover:bg-slate-800 disabled:opacity-60" disabled={saving}>
        <ClipboardCheck size={18} />
        {saving ? "Creating assignment..." : "Submit assignment"}
      </button>
    </form>
  );
}
