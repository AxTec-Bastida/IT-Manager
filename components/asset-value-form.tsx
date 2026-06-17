"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AssetValueProfile, DeviceCategory } from "@prisma/client";
import { defaultUsefulLifeMonths } from "@/lib/depreciation";

type Props = {
  deviceId: string;
  category: DeviceCategory;
  profile?: AssetValueProfile | null;
  devicePurchaseDate?: Date | null;
};

export function AssetValueForm({ deviceId, category, profile, devicePurchaseDate }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const defaultLife = defaultUsefulLifeMonths(category);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch(`/api/devices/${deviceId}/value`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save asset value.");
      router.push(`/devices/${deviceId}?value=updated`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save asset value.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "min-h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "grid gap-1 text-sm font-semibold text-slate-700";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-semibold text-slate-950">Internal estimated value</h2>
          <p className="mt-1 text-sm text-slate-600">For IT visibility only. This is not official accounting book value.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Purchase value
            <input className={inputClass} name="purchaseValue" type="number" min="0.01" step="0.01" defaultValue={profile?.purchaseValue ?? ""} placeholder="1000.00" required />
          </label>
          <label className={labelClass}>
            Currency
            <input className={inputClass} name="currency" defaultValue={profile?.currency || "MXN"} maxLength={8} required />
          </label>
          <label className={labelClass}>
            Purchase date
            <input className={inputClass} name="purchaseDate" type="date" defaultValue={formatDate(profile?.purchaseDate ?? devicePurchaseDate)} />
          </label>
          <label className={labelClass}>
            Useful life months
            <input className={inputClass} name="usefulLifeMonths" type="number" min="1" defaultValue={profile?.usefulLifeMonths ?? defaultLife} />
            <span className="text-xs font-normal text-slate-500">Default for this category: {defaultLife} months.</span>
          </label>
          <label className={labelClass}>
            Residual percent
            <input className={inputClass} name="residualPercent" type="number" min="0" max="100" step="0.01" defaultValue={profile?.residualPercent ?? 30} />
          </label>
          <label className={labelClass}>
            Method
            <select className={inputClass} name="depreciationMethod" defaultValue={profile?.depreciationMethod || "STRAIGHT_LINE"}>
              <option value="STRAIGHT_LINE">Straight line</option>
            </select>
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Notes
            <textarea className={inputClass} name="notes" rows={4} defaultValue={profile?.notes || ""} placeholder="Internal valuation context. Do not store sensitive payment details here." />
          </label>
        </div>
      </section>
      <div className="sticky bottom-20 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur lg:bottom-0">
        <button disabled={saving} className="inline-flex min-h-14 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {saving ? "Saving..." : "Save value"}
        </button>
      </div>
    </form>
  );
}

function formatDate(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
