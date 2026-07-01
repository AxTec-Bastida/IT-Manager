"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Unlink, Plus, Search } from "lucide-react";

type StockItem = {
  id: string;
  name: string;
  sku: string | null;
  quantityOnHand?: number;
};

type Props = {
  facturaId: string;
  linkedStockItems: StockItem[];
  unlinkedStockItems: StockItem[];
  canWrite: boolean;
};

export function FacturaLinkedStockPanel({ facturaId, linkedStockItems, unlinkedStockItems, canWrite }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedStockItemId, setSelectedStockItemId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredUnlinked = unlinkedStockItems.filter((item) => {
    const text = `${item.name} ${item.sku ?? ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  async function handleLink() {
    if (!selectedStockItemId) return;
    setLoading("link");
    setMessage(null);
    const res = await fetch(`/api/facturas/${facturaId}/link-stock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stockItemId: selectedStockItemId }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setMessage(data.error || "Unable to link stock item.");
      return;
    }
    setSelectedStockItemId("");
    setSearch("");
    router.refresh();
  }

  async function handleUnlink(stockItemId: string) {
    if (!window.confirm("Unlink this stock item from the factura?")) return;
    setLoading(`unlink-${stockItemId}`);
    setMessage(null);
    const res = await fetch(`/api/facturas/${facturaId}/link-stock`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stockItemId }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setMessage(data.error || "Unable to unlink stock item.");
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
                placeholder="Search unlinked stock..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-11 rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 focus:border-slate-950 focus:outline-none"
              />
            </div>
            {search && filteredUnlinked.length > 0 && (
              <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                {filteredUnlinked.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedStockItemId(item.id);
                      setSearch(`${item.sku ? `${item.sku} - ` : ""}${item.name}`);
                    }}
                    className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {item.sku ? `${item.sku} - ` : ""}{item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!selectedStockItemId || loading === "link"}
            onClick={handleLink}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus size={15} />
            Link
          </button>
        </div>
      ) : null}

      <div className="divide-y divide-slate-100 max-h-96 overflow-auto pr-1">
        {linkedStockItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2.5">
            <Link href={`/stock/${item.id}`} className="min-w-0 flex-1 hover:opacity-85">
              <p className="font-semibold text-sm text-slate-950 truncate">{item.sku ? `${item.sku} - ` : ""}{item.name}</p>
              <p className="text-xs text-slate-500">{item.quantityOnHand ?? 0} on hand</p>
            </Link>
            {canWrite ? (
              <button
                type="button"
                disabled={loading === `unlink-${item.id}`}
                onClick={() => handleUnlink(item.id)}
                className="ml-2 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors"
                title="Unlink stock item"
              >
                <Unlink size={15} />
              </button>
            ) : null}
          </div>
        ))}
        {linkedStockItems.length === 0 ? <p className="text-sm text-slate-500 py-2">No stock items linked.</p> : null}
      </div>
    </div>
  );
}
