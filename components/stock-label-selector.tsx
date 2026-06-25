"use client";

import { useState } from "react";
import type { StockItem } from "@prisma/client";
import { Search } from "lucide-react";

export function StockLabelForm({ stockItems, initialStockItemId = "" }: { stockItems: StockItem[]; initialStockItemId?: string }) {
  const [selectedId, setSelectedId] = useState(initialStockItemId);
  const [search, setSearch] = useState("");

  const filteredItems = stockItems.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    (item.barcodeValue && item.barcodeValue.toLowerCase().includes(search.toLowerCase())) ||
    (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <form className="space-y-3">
      <input type="hidden" name="mode" value="stock" />
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-950">Stockroom Label printing</p>
        <p className="mt-1">Print labels for bins, shelves, or loose consumables. Encodes the stock code (e.g. STK-XXXX) or SKU.</p>
      </div>
      
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-4 text-slate-400" size={16} />
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Type to filter stock by name, SKU, or code..." 
            className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm" 
          />
        </div>
        {search && (
          <button 
            type="button" 
            onClick={() => setSearch("")} 
            className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Select Stock Item
          <select 
            name="stockItemId" 
            value={selectedId} 
            onChange={(e) => setSelectedId(e.target.value)} 
            className="min-h-12 rounded-md border border-slate-300 px-3 bg-white text-base sm:text-sm"
            required
          >
            <option value="">-- Choose Stock Item --</option>
            {filteredItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} {item.barcodeValue ? `(${item.barcodeValue})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button 
          type="submit" 
          disabled={!selectedId} 
          className="min-h-12 rounded-md bg-slate-950 px-6 text-sm font-semibold text-white sm:mt-6 disabled:opacity-50"
        >
          Preview Stock Label
        </button>
      </div>
    </form>
  );
}
