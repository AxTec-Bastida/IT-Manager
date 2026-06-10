"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetLoan, AssetLoanItem, Device, Employee, TemporaryBorrower } from "@prisma/client";
import { AlertTriangle, Save, Search } from "lucide-react";
import { Badge } from "@/components/badge";
import { SignaturePad } from "@/components/signature-pad";
import { categoryLabels, conditionLabels, conditionOptions, statusLabels } from "@/lib/constants";

type DeviceOption = Pick<Device, "id" | "name" | "assetTag" | "serialNumber" | "model" | "category" | "status" | "assignedTo" | "employeeId" | "condition"> & {
  employee?: { fullName: string } | null;
};
type LoanWithItems = AssetLoan & { items: Array<AssetLoanItem & { device: DeviceOption }> };

type Props = {
  employees: Pick<Employee, "id" | "fullName" | "employeeId" | "department">[];
  temporaryBorrowers: Pick<TemporaryBorrower, "id" | "tempId" | "name" | "department" | "area">[];
  devices: DeviceOption[];
  loan?: LoanWithItems | null;
  initialDeviceIds?: string[];
  initialEmployeeId?: string;
  initialTemporaryBorrowerId?: string;
};

export function AssetLoanForm({ employees, temporaryBorrowers, devices, loan, initialDeviceIds = [], initialEmployeeId = "", initialTemporaryBorrowerId = "" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [borrowerKind, setBorrowerKind] = useState<"employee" | "temporary">(loan?.temporaryBorrowerId || initialTemporaryBorrowerId ? "temporary" : "employee");
  const [selected, setSelected] = useState(() => new Set(loan?.items.map((item) => item.deviceId) ?? initialDeviceIds));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  const selectedDevices = devices.filter((device) => selected.has(device.id));
  const assignedSelected = selectedDevices.filter((device) => device.employeeId || device.assignedTo);
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return devices.filter((device) => {
      const haystack = `${device.name} ${device.assetTag ?? ""} ${device.serialNumber ?? ""} ${device.model ?? ""} ${device.employee?.fullName ?? ""}`.toLowerCase();
      return !text || haystack.includes(text);
    }).slice(0, 90);
  }, [devices, query]);

  function toggle(deviceId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      employeeId: borrowerKind === "employee" ? formData.get("employeeId") : "",
      temporaryBorrowerId: borrowerKind === "temporary" ? formData.get("temporaryBorrowerId") : "",
      termsAccepted: formData.get("termsAccepted") === "on",
      allowAssigned: formData.get("allowAssigned") === "on",
      assetIds: [...selected],
    };
    const response = await fetch(loan ? `/api/loans/${loan.id}` : "/api/loans", {
      method: loan ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save asset loan.");
      return;
    }
    router.push(`/loans/${data.loan.id}`);
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">1. Borrower and dates</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Borrower type
            <select className={inputClass} value={borrowerKind} onChange={(event) => setBorrowerKind(event.target.value as "employee" | "temporary")}>
              <option value="employee">Employee</option>
              <option value="temporary">Temporary borrower</option>
            </select>
          </label>
          {borrowerKind === "employee" ? (
            <label className={labelClass}>
              Employee
              <select className={inputClass} name="employeeId" defaultValue={loan?.employeeId ?? initialEmployeeId} required={borrowerKind === "employee"}>
                <option value="">Select employee</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} {employee.employeeId ? `(${employee.employeeId})` : ""}</option>)}
              </select>
            </label>
          ) : (
            <label className={labelClass}>
              Temporary borrower
              <select className={inputClass} name="temporaryBorrowerId" defaultValue={loan?.temporaryBorrowerId ?? initialTemporaryBorrowerId} required={borrowerKind === "temporary"}>
                <option value="">Select temporary borrower</option>
                {temporaryBorrowers.map((borrower) => <option key={borrower.id} value={borrower.id}>{borrower.name} ({borrower.tempId})</option>)}
              </select>
            </label>
          )}
          <label className={labelClass}>
            Loan number
            <input className={inputClass} name="loanNumber" defaultValue={loan?.loanNumber ?? ""} placeholder="Auto-generated" />
          </label>
          <label className={labelClass}>
            Loaned by
            <input className={inputClass} name="loanedBy" defaultValue={loan?.loanedBy ?? ""} />
          </label>
          <label className={labelClass}>
            Checkout date
            <input className={inputClass} name="loanStartAt" type="date" defaultValue={dateValue(loan?.loanStartAt)} />
          </label>
          <label className={labelClass}>
            Expected return
            <input className={inputClass} name="expectedReturnAt" type="date" defaultValue={dateValue(loan?.expectedReturnAt, 3)} required />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">2. Select serialized assets</h2>
        <label className={`${labelClass} mt-4 block`}>
          Search assets
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-4 text-slate-400" size={18} />
            <input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Asset tag, serial, model, employee" />
          </span>
        </label>
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">{selected.size} selected</div>
        {assignedSelected.length ? (
          <div className="mt-3 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>{assignedSelected.length} selected asset{assignedSelected.length === 1 ? " is" : "s are"} currently assigned. Checkout preserves assignment history and does not clear the assignment.</p>
            </div>
            <label className="flex min-h-11 items-center gap-2 font-semibold">
              <input type="checkbox" name="allowAssigned" className="size-5" defaultChecked={Boolean(loan)} />
              Confirm checkout of assigned asset(s)
            </label>
          </div>
        ) : null}
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {filtered.map((device) => (
            <label key={device.id} className="flex min-h-24 gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0" checked={selected.has(device.id)} onChange={() => toggle(device.id)} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">{device.name}</span>
                  <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[device.category]}</Badge>
                </span>
                <span className="mt-1 block text-sm text-slate-500">{device.assetTag || "No tag"} / {device.serialNumber || "No serial"}</span>
                <span className="block text-sm text-slate-500">{device.model || "No model"} / {statusLabels[device.status]}</span>
                {device.employee || device.assignedTo ? <span className="mt-1 block text-sm font-medium text-amber-700">Assigned to {device.employee?.fullName || device.assignedTo}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">3. Checkout condition</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Condition out
            <select className={inputClass} name="conditionOut" defaultValue={loan?.items[0]?.conditionOut ?? "GOOD"}>
              {conditionOptions.map((condition) => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Accessories out
            <input className={inputClass} name="accessoriesOut" defaultValue={loan?.items[0]?.accessoriesOut ?? ""} placeholder="Charger, case, dock..." />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Checkout notes
            <textarea className={inputClass} name="checkoutNotes" rows={4} defaultValue={loan?.checkoutNotes ?? ""} />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Terms text
            <textarea className={inputClass} name="termsText" rows={3} defaultValue={loan?.termsText ?? "Borrower accepts temporary responsibility for the listed serialized asset(s) and agrees to return them by the expected return date."} />
          </label>
          <label className="flex min-h-12 items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="termsAccepted" className="size-5" defaultChecked={loan?.termsAccepted ?? false} />
            Terms accepted
          </label>
          <div className="lg:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-700">Borrower signature (optional)</p>
            <SignaturePad name="signatureData" />
            {loan?.signatureData ? <p className="mt-2 text-xs text-slate-500">This loan already has a saved signature. Drawing a new one will replace it.</p> : null}
          </div>
        </div>
      </section>

      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving || selected.size === 0}>
        <Save size={17} />
        {saving ? "Saving..." : loan ? "Save Loan" : "Create Loan"}
      </button>
    </form>
  );
}

function dateValue(value?: Date | string | null, plusDays = 0) {
  const date = value ? new Date(value) : new Date();
  if (!value && plusDays) date.setDate(date.getDate() + plusDays);
  return date.toISOString().slice(0, 10);
}
