"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Employee } from "@prisma/client";
import { Save } from "lucide-react";

export function EmployeeForm({ employee }: { employee?: Employee | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md sm:min-h-12 border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const response = await fetch(employee ? `/api/employees/${employee.id}` : "/api/employees", {
      method: employee ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to save employee.");
      return;
    }
    router.push(`/employees/${data.employee.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-5 lg:grid-cols-2">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 lg:col-span-2">{error}</div> : null}
      <label className={labelClass}>
        Full name
        <input className={inputClass} name="fullName" defaultValue={employee?.fullName ?? ""} required />
      </label>
      <label className={labelClass}>
        Employee ID
        <input className={inputClass} name="employeeId" defaultValue={employee?.employeeId ?? ""} />
      </label>
      <label className={labelClass}>
        Email
        <input className={inputClass} name="email" type="email" defaultValue={employee?.email ?? ""} />
      </label>
      <label className={labelClass}>
        Phone
        <input className={inputClass} name="phoneNumber" defaultValue={employee?.phoneNumber ?? ""} />
      </label>
      <label className={labelClass}>
        Department
        <input className={inputClass} name="department" defaultValue={employee?.department ?? ""} />
      </label>
      <label className={labelClass}>
        Position/title
        <input className={inputClass} name="title" defaultValue={employee?.title ?? ""} />
      </label>
      <label className={labelClass}>
        Site/location
        <input className={inputClass} name="site" defaultValue={employee?.site ?? ""} />
      </label>
      <label className={labelClass}>
        Status
        <select className={inputClass} name="status" defaultValue={employee?.status ?? "ACTIVE"}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </label>
      <label className={labelClass}>
        Supervisor name
        <input className={inputClass} name="supervisorName" defaultValue={employee?.supervisorName ?? ""} />
      </label>
      <label className={labelClass}>
        Supervisor email
        <input className={inputClass} name="supervisorEmail" type="email" defaultValue={employee?.supervisorEmail ?? ""} />
      </label>
      <label className={`${labelClass} lg:col-span-2`}>
        Notes
        <textarea className={inputClass} name="notes" rows={4} defaultValue={employee?.notes ?? ""} />
      </label>
      <div className="lg:col-span-2">
        <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:w-auto sm:text-sm" disabled={saving}>
          <Save size={16} />
          {saving ? "Saving..." : "Save employee"}
        </button>
      </div>
    </form>
  );
}
