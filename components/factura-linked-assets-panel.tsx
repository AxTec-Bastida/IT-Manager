"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Unlink, Plus, Search } from "lucide-react";

type Asset = {
  id: string;
  name: string;
  assetTag: string | null;
  serialNumber: string | null;
  photos?: unknown[];
};

type Props = {
  facturaId: string;
  linkedAssets: Asset[];
  unlinkedAssets: Asset[];
  canWrite: boolean;
};

export function FacturaLinkedAssetsPanel({ facturaId, linkedAssets, unlinkedAssets, canWrite }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredUnlinked = unlinkedAssets.filter((a) => {
    const text = `${a.name} ${a.assetTag ?? ""} ${a.serialNumber ?? ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  async function handleLink() {
    if (!selectedAssetId) return;
    setLoading("link");
    setMessage(null);
    const res = await fetch(`/api/facturas/${facturaId}/link-asset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: selectedAssetId }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setMessage(data.error || "Unable to link asset.");
      return;
    }
    setSelectedAssetId("");
    setSearch("");
    router.refresh();
  }

  async function handleUnlink(assetId: string) {
    if (!window.confirm("Unlink this asset from the factura?")) return;
    setLoading(`unlink-${assetId}`);
    setMessage(null);
    const res = await fetch(`/api/facturas/${facturaId}/link-asset`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setMessage(data.error || "Unable to unlink asset.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-md bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200">{message}</p> : null}

      {canWrite ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search unlinked assets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-11 rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 focus:border-slate-950 focus:outline-none"
              />
            </div>
            {search && filteredUnlinked.length > 0 && (
              <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                {filteredUnlinked.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      setSelectedAssetId(asset.id);
                      setSearch(`${asset.assetTag ? `${asset.assetTag} - ` : ""}${asset.name}`);
                    }}
                    className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {asset.assetTag ? `${asset.assetTag} - ` : ""}{asset.name} {asset.serialNumber ? `(${asset.serialNumber})` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!selectedAssetId || loading === "link"}
            onClick={handleLink}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus size={15} />
            Link
          </button>
        </div>
      ) : null}

      <div className="divide-y divide-slate-100 max-h-96 overflow-auto pr-1">
        {linkedAssets.map((asset) => (
          <div key={asset.id} className="flex items-center justify-between py-2.5">
            <Link href={`/devices/${asset.id}`} className="min-w-0 flex-1 hover:opacity-85">
              <p className="font-semibold text-sm text-slate-950 truncate">{asset.assetTag ? `${asset.assetTag} - ` : ""}{asset.name}</p>
              <p className="text-xs text-slate-500 truncate">{asset.serialNumber || "No serial"} {asset.photos ? `• ${asset.photos.length} photo(s)` : ""}</p>
            </Link>
            {canWrite ? (
              <button
                type="button"
                disabled={loading === `unlink-${asset.id}`}
                onClick={() => handleUnlink(asset.id)}
                className="ml-2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors"
                title="Unlink asset"
              >
                <Unlink size={15} />
              </button>
            ) : null}
          </div>
        ))}
        {linkedAssets.length === 0 ? <p className="text-sm text-slate-500 py-2">No assets linked.</p> : null}
      </div>
    </div>
  );
}
