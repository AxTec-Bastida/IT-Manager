"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";

type ExistingRecord = {
  keyId?: string | null;
  volumeLabel?: string | null;
  protectorId?: string | null;
  source?: string | null;
  notes?: string | null;
} | null;

export function BitLockerVaultForm({ deviceId, existingRecord }: { deviceId: string; existingRecord: ExistingRecord }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-slate-950 focus:outline-none";

  async function submit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = {
      recoveryKey: String(formData.get("recoveryKey") || "").trim() || null,
      keyId: String(formData.get("keyId") || "").trim() || null,
      volumeLabel: String(formData.get("volumeLabel") || "").trim() || null,
      protectorId: String(formData.get("protectorId") || "").trim() || null,
      source: String(formData.get("source") || "MANUAL"),
      notes: String(formData.get("notes") || "").trim() || null,
    };
    const response = await fetch(`/api/devices/${deviceId}/bitlocker`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Could not save BitLocker vault record.");
      return;
    }
    router.push(`/devices/${deviceId}/bitlocker?saved=1`);
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      {message ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">{message}</p> : null}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Recovery keys are encrypted before storage. Leave the recovery key field blank only when updating metadata for an existing record.
      </div>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Recovery key
        <input className={inputClass} name="recoveryKey" placeholder="111111-222222-333333-444444-555555-666666-777777-888888" autoComplete="off" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Key ID
          <input className={inputClass} name="keyId" defaultValue={existingRecord?.keyId ?? ""} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Volume label
          <input className={inputClass} name="volumeLabel" defaultValue={existingRecord?.volumeLabel ?? "OS"} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Protector ID
          <input className={inputClass} name="protectorId" defaultValue={existingRecord?.protectorId ?? ""} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Source
          <select className={inputClass} name="source" defaultValue={existingRecord?.source ?? "MANUAL"}>
            <option value="MANUAL">Manual</option>
            <option value="IMPORT">Import</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Notes
        <textarea className={inputClass} name="notes" rows={4} defaultValue={existingRecord?.notes ?? ""} />
      </label>
      <button disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto">
        <Save size={16} />
        {saving ? "Saving..." : "Save BitLocker record"}
      </button>
    </form>
  );
}
