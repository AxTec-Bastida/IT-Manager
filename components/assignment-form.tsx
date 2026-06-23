"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { AssignmentTarget, Device, Employee } from "@prisma/client";
import { ClipboardCheck, ClipboardList, PackageCheck, X } from "lucide-react";
import { SignaturePad } from "@/components/signature-pad";
import { categoryLabels, conditionLabels, statusLabels } from "@/lib/constants";
import { ScanAutocomplete } from "@/components/scan-autocomplete";

export function AssignmentForm({ employees, assets, targets = [] }: { employees: Employee[]; assets: Device[]; targets?: AssignmentTarget[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    employees.find((e) => e.id === searchParams.get("employeeId")) ?? null
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(searchParams.get("assetId") ? [searchParams.get("assetId")!] : []);
  const [filteredAssets] = useState<Device[]>(assets);
  const [targetMode, setTargetMode] = useState<"EMPLOYEE" | "TEAM" | "AREA" | "STATION">((searchParams.get("targetType") as "EMPLOYEE" | "TEAM" | "AREA" | "STATION") || "EMPLOYEE");
  const [targetPath, setTargetPath] = useState(searchParams.get("targetPath") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <p className="font-semibold">Assignments are for long-term equipment responsibility.</p>
        <p className="mt-1 text-sky-800">For temporary serialized checkout use Quick Asset Loan. For keyboards, mice, cables, or other quantity stock use Issue / Loan Item.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/loans/quick-checkout" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-sky-300 bg-white px-3 font-semibold text-sky-900 hover:bg-sky-100">
            <ClipboardList size={16} />
            Quick Asset Loan
          </Link>
          <Link href="/stock/issue" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-sky-300 bg-white px-3 font-semibold text-sky-900 hover:bg-sky-100">
            <PackageCheck size={16} />
            Issue / Loan Item
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">1. Responsibility target</h2>
        <p className="mt-1 text-sm text-slate-600">Choose who or what is responsible for the asset. This is separate from physical location.</p>
        <input type="hidden" name="targetType" value={targetMode} />
        <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
          {[
            ["EMPLOYEE", "Person"],
            ["TEAM", "Team / Department"],
            ["AREA", "Area / Station"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTargetMode(value as typeof targetMode)}
              className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${targetMode === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {targetMode === "EMPLOYEE" ? (
          <div className="mt-3">
            <ScanAutocomplete
              show={["employees"]}
              placeholder="Type employee name or ID..."
              inputClassName="min-h-12 py-2"
              onSelect={(s) => {
                if (s.kind === "employee") {
                  const emp = employees.find((e) => e.id === s.id) ?? null;
                  setSelectedEmployee(emp);
                }
              }}
            />
            {selectedEmployee && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{selectedEmployee.fullName}</p>
                  <p className="text-xs text-slate-500">{[selectedEmployee.employeeId, selectedEmployee.department].filter(Boolean).join(" / ")}</p>
                </div>
                <button type="button" onClick={() => setSelectedEmployee(null)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                  <X size={14} />
                </button>
                <input type="hidden" name="employeeId" value={selectedEmployee.id} />
              </div>
            )}
            {!selectedEmployee && <input type="hidden" name="employeeId" value="" />}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Responsibility path
              <input
                name="targetPath"
                value={targetPath}
                onChange={(event) => setTargetPath(event.target.value)}
                placeholder="Ops > Fabletics > Pack"
                className="mt-1 min-h-14 w-full rounded-md border border-slate-300 px-3 text-base sm:min-h-12 sm:text-sm"
              />
            </label>
            <input type="hidden" name="targetName" value={targetPath.split(">").pop()?.trim() || targetPath} />
            <div className="flex flex-wrap gap-2">
              {[...new Set(["Operations", "Ops > Fabletics > Pack", "Returns", "Shipping", "IT", "Packing Station 4", ...targets.slice(0, 8).map((target) => target.path)])].map((chip) => (
                <button key={chip} type="button" onClick={() => setTargetPath(chip)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">2. Assets</h2>
        <ScanAutocomplete
          show={["devices"]}
          placeholder="Search asset tag, serial, name, IP, MAC, model"
          inputClassName="min-h-12 py-2"
          className="mt-3"
          onSelect={(s) => {
            if (s.kind === "device" && !selectedAssetIds.includes(s.id)) {
              setSelectedAssetIds((cur) => [...cur, s.id]);
            }
          }}
        />
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
                <p className="mt-1 text-xs opacity-80">{categoryLabels[asset.category]} / {conditionLabels[asset.condition]}</p>
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
          Responsible person or area accepted the responsibility terms.
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
