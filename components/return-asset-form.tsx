"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { conditionLabels } from "@/lib/constants";
import { returnConditionOptions } from "@/lib/assignments";

type ReturnAssetFormProps = {
  assetId: string;
  assetName: string;
  employeeName?: string | null;
};

export function ReturnAssetForm({ assetId, assetName, employeeName }: ReturnAssetFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/devices/${assetId}/return`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        returnCondition: formData.get("returnCondition"),
        returnNotes: formData.get("returnNotes"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Unable to return this asset.");
      return;
    }
    router.push(`/devices/${assetId}?returned=1`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Return / Unassign</h2>
        <p className="mt-1 text-sm text-slate-600">
          {employeeName ? `Return ${assetName} from ${employeeName}.` : `Return ${assetName} to available inventory.`}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-950">Return condition</legend>
        <div className="grid gap-2">
          {returnConditionOptions.map((condition) => (
            <label key={condition} className="flex min-h-14 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800">
              <input type="radio" name="returnCondition" value={condition} defaultChecked={condition === "GOOD"} className="size-4" />
              {conditionLabels[condition]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm font-semibold text-slate-950">
        Return notes
        <textarea name="returnNotes" rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base font-normal text-slate-950 sm:text-sm" placeholder="Optional notes about condition, missing accessories, or where it was returned." />
      </label>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}

      <div className="grid gap-2 sm:flex">
        <button type="submit" disabled={saving} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:min-h-12 sm:text-sm">
          <RotateCcw size={18} />
          {saving ? "Returning..." : "Confirm return"}
        </button>
        <button type="button" onClick={() => router.back()} className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 px-5 text-base font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12 sm:text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
