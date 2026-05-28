"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";

export function MapConfigForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    const payload = { ...Object.fromEntries(formData.entries()), active: true };
    const response = await fetch("/api/warehouse-map", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setMessage(response.ok ? "Map configuration saved." : "Unable to save map configuration.");
    router.refresh();
  }

  return (
    <form action={onSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-4">
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Map name
        <input name="name" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="Warehouse main floor" required />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-2">
        Image URL/path
        <input name="imageUrl" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="/warehouse-map.svg" required />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700">
        Floor name
        <input name="floorName" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="Floor 1" />
      </label>
      <label className="space-y-1 text-sm font-medium text-slate-700 lg:col-span-3">
        Notes
        <input name="notes" className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base sm:text-sm" placeholder="Put custom images in /public and reference them as /your-map.png" />
      </label>
      <div className="flex items-end">
        <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          <Save size={16} />
          Save map
        </button>
      </div>
      {message ? <p className="text-sm text-slate-600 lg:col-span-4">{message}</p> : null}
    </form>
  );
}
