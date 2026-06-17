"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Link2, RotateCcw } from "lucide-react";
import { categoryLabels } from "@/lib/constants";

type AssetOption = {
  id: string;
  name: string;
  assetTag: string | null;
  serialNumber: string | null;
  model: string | null;
  category: string;
  valueProfile?: { id: string } | null;
  facturaLineItemLinks?: Array<{ id: string; lineItem: { description: string; factura: { facturaNumber: string } } }>;
};

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  currency: string;
  assetLinks: Array<{ id: string; deviceId: string; device: AssetOption }>;
};

export function FacturaLineItemLinkAssets({ facturaId, lineItem, assets, q }: { facturaId: string; lineItem: LineItem; assets: AssetOption[]; q: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const remaining = Math.max(0, lineItem.quantity - lineItem.assetLinks.length);

  async function linkAssets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const assetIds = new FormData(event.currentTarget).getAll("assetIds").map(String);
    const response = await fetch(`/api/facturas/${facturaId}/line-items/${lineItem.id}/link-assets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetIds }),
    });
    const data = await response.json();
    setSaving(false);
    setMessage(response.ok ? `Linked ${data.linked} asset(s).` : data.error || "Unable to link assets.");
    if (response.ok) router.refresh();
  }

  async function postAction(url: string, body: Record<string, unknown>, success: string) {
    setSaving(true);
    setMessage(null);
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    setSaving(false);
    setMessage(response.ok ? success : data.error || "Action failed.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      {message ? <div className={`rounded-md border p-3 text-sm ${message.startsWith("Unable") || message.includes("not found") || message.includes("Cannot") || message.includes("already") ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{message}</div> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Linked assets</h2>
        <p className="mt-1 text-sm text-slate-600">Linked {lineItem.assetLinks.length} of quantity {lineItem.quantity}. {remaining} remaining.</p>
        <div className="mt-3 grid gap-3">
          {lineItem.assetLinks.map((link) => (
            <div key={link.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-950">{link.device.assetTag || link.device.name}</p>
              <p className="text-slate-600">{link.device.name} / {link.device.serialNumber || "No serial"}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link href={`/devices/${link.device.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700">Open asset</Link>
                <button disabled={saving} onClick={() => postAction(`/api/facturas/${facturaId}/line-items/${lineItem.id}/unlink-assets`, { assetId: link.deviceId }, "Asset unlinked.")} className="inline-flex min-h-11 items-center justify-center rounded-md border border-rose-300 bg-white px-3 font-semibold text-rose-700">Unlink</button>
              </div>
            </div>
          ))}
          {!lineItem.assetLinks.length ? <p className="text-sm text-slate-500">No assets linked yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Apply value to linked assets</h2>
        <p className="mt-1 text-sm text-slate-600">Uses {lineItem.currency} {lineItem.unitCost.toFixed(2)} per linked asset. Existing value profiles are skipped unless overwrite is checked.</p>
        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          <input type="checkbox" checked={overwriteExisting} onChange={(event) => setOverwriteExisting(event.currentTarget.checked)} />
          Overwrite existing asset value profiles
        </label>
        <button
          disabled={saving || !lineItem.assetLinks.length}
          onClick={() => postAction(`/api/facturas/${facturaId}/line-items/${lineItem.id}/apply-values`, { overwriteExisting }, "Values applied to linked assets.")}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <RotateCcw size={16} />
          Apply unit cost to linked assets
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Search and link assets</h2>
        <form className="mt-3 grid gap-2 sm:flex">
          <input name="q" defaultValue={q} className="min-h-12 w-full rounded-md border border-slate-300 px-3 text-base" placeholder="Asset tag, serial, model, category" />
          <button className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Search</button>
        </form>
        <form onSubmit={linkAssets} className="mt-4 space-y-3">
          {assets.map((asset) => {
            const alreadyLinkedElsewhere = asset.facturaLineItemLinks?.find((link) => link.id);
            return (
              <label key={asset.id} className="block rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start gap-3">
                  <input name="assetIds" value={asset.id} type="checkbox" className="mt-1" disabled={Boolean(alreadyLinkedElsewhere) || remaining <= 0} />
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-slate-950">{asset.assetTag || asset.name}</p>
                    <p className="text-slate-600">{asset.name} / {asset.serialNumber || "No serial"} / {categoryLabels[asset.category as keyof typeof categoryLabels] ?? asset.category}</p>
                    {asset.valueProfile ? <p className="mt-1 text-xs font-semibold text-amber-700">Has asset value profile</p> : null}
                    {alreadyLinkedElsewhere ? <p className="mt-1 text-xs font-semibold text-rose-700">Already linked to {alreadyLinkedElsewhere.lineItem.factura.facturaNumber}: {alreadyLinkedElsewhere.lineItem.description}</p> : null}
                  </div>
                </div>
              </label>
            );
          })}
          {!assets.length ? <p className="text-sm text-slate-500">Search for assets to link.</p> : null}
          <button disabled={saving || remaining <= 0} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white disabled:opacity-60">
            <Link2 size={16} />
            Link selected assets
          </button>
        </form>
      </section>
    </div>
  );
}
