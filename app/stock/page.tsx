import Link from "next/link";
import { Package, Plus, Search, SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { stockCategoryLabels, stockCategoryOptions, stockItemTypeLabels, stockItemTypeOptions } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const itemType = typeof params.itemType === "string" ? params.itemType : "";
  const lowOnly = params.lowOnly === "true";

  const stockItems = await prisma.stockItem.findMany({
    where: {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { vendorName: { contains: q } },
              { compatibleModels: { contains: q } },
              { storageLocation: { contains: q } },
            ],
          }
        : {}),
      ...(category ? { category: category as never } : {}),
      ...(itemType ? { itemType: itemType as never } : {}),
    },
    orderBy: [{ quantityOnHand: "asc" }, { name: "asc" }],
  });
  const filteredItems = lowOnly ? stockItems.filter((item) => item.quantityOnHand <= item.minimumQuantity) : stockItems;
  const activeFilters = [
    category ? stockCategoryLabels[category as keyof typeof stockCategoryLabels] : null,
    itemType ? stockItemTypeLabels[itemType as keyof typeof stockItemTypeLabels] : null,
    lowOnly ? "Low stock only" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description="Consumables, peripherals, printer supplies, and spare parts tracked by quantity."
        action={
          <Link href="/stock/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus size={16} />
            Add stock
          </Link>
        }
      />

      <form className="sticky top-[73px] z-20 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:static lg:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={18} />
            <input name="q" defaultValue={q} className="min-h-14 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base sm:min-h-12" placeholder="Search stock, SKU, vendor, location" />
          </label>
          <button className="inline-flex min-h-14 items-center justify-center rounded-md bg-slate-950 px-4 font-semibold text-white sm:min-h-12">Search</button>
        </div>
        {activeFilters.length ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filter}</span>)}
            <Link href="/stock" className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">Clear</Link>
          </div>
        ) : null}
        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Filters</span>
            <span className="text-xs text-slate-500">{activeFilters.length ? `${activeFilters.length} active` : "Optional"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <select name="category" defaultValue={category} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base">
              <option value="">All categories</option>
              {stockCategoryOptions.map((option) => <option key={option} value={option}>{stockCategoryLabels[option]}</option>)}
            </select>
            <select name="itemType" defaultValue={itemType} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base">
              <option value="">All item types</option>
              {stockItemTypeOptions.map((option) => <option key={option} value={option}>{stockItemTypeLabels[option]}</option>)}
            </select>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="lowOnly" value="true" type="checkbox" defaultChecked={lowOnly} className="size-4" />
              Low stock only
            </label>
            <button className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 font-semibold text-white md:col-span-2 lg:col-span-3">Apply filters</button>
          </div>
        </details>
      </form>

      <section className="grid gap-3 lg:hidden">
        {filteredItems.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{item.name}</h2>
                <p className="text-sm text-slate-500">{item.sku || "No SKU"} • {stockCategoryLabels[item.category]}</p>
              </div>
              {item.quantityOnHand <= item.minimumQuantity ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">OK</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">On hand</span><p className="text-lg font-semibold">{item.quantityOnHand}</p></div>
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Minimum</span><p className="text-lg font-semibold">{item.minimumQuantity}</p></div>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.storageLocation || "No storage location"} • {stockItemTypeLabels[item.itemType]}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link href={`/stock/${item.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"><Package size={17} />Open</Link>
              <Link href={`/stock/${item.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Add</Link>
              <Link href={`/stock/${item.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Adjust</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">On hand</th>
              <th className="px-4 py-3">Minimum</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Vendor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link className="font-medium text-slate-950 hover:underline" href={`/stock/${item.id}`}>{item.name}</Link>
                  <p className="text-xs text-slate-500">{item.sku || "No SKU"} • {stockCategoryLabels[item.category]}</p>
                </td>
                <td className="px-4 py-3">{stockItemTypeLabels[item.itemType]}</td>
                <td className="px-4 py-3 font-semibold">{item.quantityOnHand}</td>
                <td className="px-4 py-3">{item.minimumQuantity}</td>
                <td className="px-4 py-3">{item.storageLocation || "-"}</td>
                <td className="px-4 py-3">{item.vendorName || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {filteredItems.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No stock items match this view.</p> : null}
    </div>
  );
}
