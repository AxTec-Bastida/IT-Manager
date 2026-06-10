"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TemporaryBorrower } from "@prisma/client";
import { Save } from "lucide-react";

type Props = {
  borrower?: TemporaryBorrower | null;
  defaultName?: string;
};

export function TemporaryBorrowerForm({ borrower, defaultName = "" }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const payload = { ...Object.fromEntries(formData.entries()), active: formData.get("active") === "on" };
    const response = await fetch(borrower ? `/api/temporary-borrowers/${borrower.id}` : "/api/temporary-borrowers", {
      method: borrower ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to save temporary borrower.");
      return;
    }
    router.push(`/temporary-borrowers/${data.borrower.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Borrower info</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Temporary ID
            <input className={inputClass} name="tempId" defaultValue={borrower?.tempId ?? ""} placeholder="Auto-generated if blank" />
          </label>
          <label className={labelClass}>
            Name
            <input className={inputClass} name="name" defaultValue={borrower?.name ?? defaultName} required placeholder="Contractor or visitor name" />
          </label>
          <label className={labelClass}>
            Department
            <input className={inputClass} name="department" defaultValue={borrower?.department ?? ""} />
          </label>
          <label className={labelClass}>
            Area
            <input className={inputClass} name="area" defaultValue={borrower?.area ?? ""} placeholder="Packing, Receiving, IT cage" />
          </label>
          <label className={labelClass}>
            Supervisor
            <input className={inputClass} name="supervisorName" defaultValue={borrower?.supervisorName ?? ""} />
          </label>
          <label className={labelClass}>
            Phone
            <input className={inputClass} name="phone" defaultValue={borrower?.phone ?? ""} />
          </label>
          <label className={labelClass}>
            Email
            <input className={inputClass} name="email" type="email" defaultValue={borrower?.email ?? ""} />
          </label>
          <label className={labelClass}>
            Reason
            <input className={inputClass} name="reason" defaultValue={borrower?.reason ?? ""} placeholder="Temporary worker, visitor, contractor" />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} defaultValue={borrower?.notes ?? ""} />
          </label>
          <label className="flex min-h-12 items-center gap-2 text-sm font-medium text-slate-700">
            <input className="size-4" name="active" type="checkbox" defaultChecked={borrower?.active ?? true} />
            Active temporary borrower
          </label>
        </div>
      </section>
      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto" disabled={saving}>
        <Save size={16} />
        {saving ? "Saving..." : "Save borrower"}
      </button>
    </form>
  );
}
