"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ToolLink } from "@prisma/client";
import { Save } from "lucide-react";
import { toolLinkCategoryLabels, toolLinkCategoryOptions } from "@/lib/constants";

export function ToolLinkForm({ toolLink }: { toolLink?: ToolLink | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const payload = {
      ...Object.fromEntries(formData.entries()),
      isFavorite: formData.get("isFavorite") === "on",
      requiresVpn: formData.get("requiresVpn") === "on",
      internalOnly: formData.get("internalOnly") === "on",
      requiresCredentials: formData.get("requiresCredentials") === "on",
      active: formData.get("active") === "on",
    };
    const response = await fetch(toolLink ? `/api/tools/${toolLink.id}` : "/api/tools", {
      method: toolLink ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save tool link.");
      return;
    }
    router.push("/tools");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Resource link</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={labelClass}>
            Name
            <input className={inputClass} name="name" defaultValue={toolLink?.name ?? ""} required />
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} name="category" defaultValue={toolLink?.category ?? "OTHER"}>
              {toolLinkCategoryOptions.map((category) => <option key={category} value={category}>{toolLinkCategoryLabels[category]}</option>)}
            </select>
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            URL
            <input className={inputClass} name="url" type="url" defaultValue={toolLink?.url ?? ""} required placeholder="https://..." />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Description
            <textarea className={inputClass} name="description" rows={3} defaultValue={toolLink?.description ?? ""} />
          </label>
          <label className={labelClass}>
            Icon label
            <input className={inputClass} name="icon" defaultValue={toolLink?.icon ?? ""} placeholder="Optional short label" />
          </label>
          <label className={labelClass}>
            Color
            <input className={inputClass} name="color" defaultValue={toolLink?.color ?? ""} placeholder="#0f172a" />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Flags</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Checkbox name="isFavorite" label="Favorite" checked={toolLink?.isFavorite ?? false} />
          <Checkbox name="requiresVpn" label="VPN required" checked={toolLink?.requiresVpn ?? false} />
          <Checkbox name="internalOnly" label="Internal only" checked={toolLink?.internalOnly ?? false} />
          <Checkbox name="requiresCredentials" label="Requires user credentials" checked={toolLink?.requiresCredentials ?? false} />
          <Checkbox name="active" label="Active link" checked={toolLink?.active ?? true} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className={labelClass}>
          Notes
          <textarea className={inputClass} name="notes" rows={4} defaultValue={toolLink?.notes ?? ""} placeholder="Do not store passwords, tokens, API keys, or secrets here." />
        </label>
      </section>

      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving}>
        <Save size={17} />
        {saving ? "Saving..." : "Save resource"}
      </button>
    </form>
  );
}

function Checkbox({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
      <input className="size-4" name={name} type="checkbox" defaultChecked={checked} />
      {label}
    </label>
  );
}
