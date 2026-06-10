import Link from "next/link";
import type { ElementType } from "react";
import { Archive, BatteryCharging, Cable, Package, PackageCheck, Plus, Search, SlidersHorizontal, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { stockCategoryLabels, stockCategoryOptions, stockItemTypeLabels, stockItemTypeOptions } from "@/lib/constants";
import { detectSuspiciousStockComments } from "@/lib/data-quality";
import { suggestStockCategory } from "@/lib/stock-classification";
import { sortStockWorkflowMatches } from "@/lib/item-workflow-classification";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const itemType = typeof params.itemType === "string" ? params.itemType : "";
  const lowOnly = params.lowOnly === "true";
  const showInactive = params.showInactive === "true";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const pageSize = 50;

  const stockWhere = {
    ...(showInactive ? {} : { active: true }),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { barcodeValue: { contains: q } },
            { vendorName: { contains: q } },
            { compatibleModels: { contains: q } },
            { storageLocation: { contains: q } },
          ],
        }
      : {}),
    ...(category ? { category: category as never } : {}),
    ...(itemType ? { itemType: itemType as never } : {}),
  };

  const [stockItems, allStockItems, activeStockLoans] = await Promise.all([
    prisma.stockItem.findMany({
      where: stockWhere,
      orderBy: [{ quantityOnHand: "asc" }, { name: "asc" }],
      include: {
        stockIssues: { select: { status: true } },
        _count: { select: { movements: true, maintenanceRecords: true, stockIssues: true, purchaseNoteItems: true } },
      },
    }),
    prisma.stockItem.findMany({
      include: {
        stockIssues: { select: { status: true } },
        _count: { select: { movements: true, maintenanceRecords: true, stockIssues: true, purchaseNoteItems: true } },
      },
    }),
    prisma.stockIssue.count({ where: { issueType: "LOAN", status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } }),
  ]);

  const filteredItems = sortStockWorkflowMatches(lowOnly ? stockItems.filter((item) => item.quantityOnHand <= item.minimumQuantity) : stockItems, q);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);
  const startItem = filteredItems.length ? (safePage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(safePage * pageSize, filteredItems.length);
  const activeItems = allStockItems.filter((item) => item.active !== false);
  const lowStockCount = activeItems.filter((item) => item.quantityOnHand <= item.minimumQuantity).length;
  const zeroOnHandCount = activeItems.filter((item) => item.quantityOnHand === 0).length;
  const needsCategoryCount = activeItems.filter((item) => {
    const suggestion = suggestStockCategory(item);
    return suggestion && suggestion.category !== item.category;
  }).length;
  const suspiciousCount = detectSuspiciousStockComments(allStockItems).length;
  const archivedCount = allStockItems.filter((item) => item.active === false).length;
  const activeFilters = [
    category ? stockCategoryLabels[category as keyof typeof stockCategoryLabels] : null,
    itemType ? stockItemTypeLabels[itemType as keyof typeof stockItemTypeLabels] : null,
    lowOnly ? "Low stock only" : null,
    showInactive ? "Showing archived" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stockroom"
        description="What we have on hand: quantity-based consumables, accessories/peripherals, printer supplies, maintenance supplies, and spare parts."
        action={
          <div className="grid gap-2 sm:flex">
            <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Search size={16} />
              Scan stock
            </Link>
            <Link href="/stock/issue" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <PackageCheck size={16} />
              Issue / loan item
            </Link>
            <Link href="/stock/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Plus size={16} />
              Add stock item
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StockSignalCard href="/stock?lowOnly=true" label="Low stock" value={lowStockCount} helper="At or below minimum" />
        <StockSignalCard href="/stock/issues?view=active" label="Active loans" value={activeStockLoans} helper="Stock expected back" />
        <StockSignalCard href="/stock?lowOnly=false" label="Zero on hand" value={zeroOnHandCount} helper="Available count is 0" />
        <StockSignalCard href="/data-quality" label="Needs category" value={needsCategoryCount} helper="Suggested cleanup" />
        <StockSignalCard href="/data-quality" label="Archived/comments" value={archivedCount || suspiciousCount} helper={archivedCount ? "Hidden by default" : "Review detected rows"} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CategoryCard href="/stock?category=CABLE" icon={Cable} label="Cables" helper="USB, Lightning, scanner cables" />
        <CategoryCard href="/stock?category=CHARGER" icon={Zap} label="Chargers / Adapters" helper="PD chargers, power adapters" />
        <CategoryCard href="/stock?category=PRINTER_SUPPLY" icon={Package} label="Printer supplies" helper="Labels, ribbons, supplies" />
        <CategoryCard href="/stock?category=DISPLAY_BASE" icon={Package} label="Display bases" helper="Display and arm bases" />
        <CategoryCard href="/stock?category=BATTERY" icon={BatteryCharging} label="Batteries" helper="Batteries and battery packs" />
        <CategoryCard href="/stock?category=PRINTER_PART" icon={Package} label="Printer parts" helper="Printheads, rollers, parts" />
        <CategoryCard href="/stock?category=ACCESSORY" icon={Package} label="Accessories" helper="Protectors, covers, generic peripherals" />
        <CategoryCard href="/stock?showInactive=true" icon={Archive} label="Archived" helper="Hidden comment rows and inactive stock" />
      </section>

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
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="showInactive" value="true" type="checkbox" defaultChecked={showInactive} className="size-4" />
              Show archived
            </label>
            <button className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 font-semibold text-white md:col-span-2 lg:col-span-3">Apply filters</button>
          </div>
        </details>
      </form>

      <section className="grid gap-3 lg:hidden">
        {pagedItems.map((item) => {
          const suggestion = suggestStockCategory(item);
          const hasSuggestion = suggestion && suggestion.category !== item.category;
          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">{item.name}</h2>
                  <p className="text-sm text-slate-500">{item.sku || "No SKU"} / {stockCategoryLabels[item.category]}{item.active ? "" : " / Archived"}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {!item.active ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Archived</Badge> : null}
                  {item.quantityOnHand <= item.minimumQuantity ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Low</Badge> : <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">OK</Badge>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">On hand</span><p className="text-lg font-semibold">{item.quantityOnHand}</p></div>
                <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Minimum</span><p className="text-lg font-semibold">{item.minimumQuantity}</p></div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.storageLocation || "No storage location"} / {stockItemTypeLabels[item.itemType]}</p>
              {hasSuggestion ? <p className="mt-2 rounded-md bg-sky-50 p-2 text-sm font-medium text-sky-900">Suggested category: {stockCategoryLabels[suggestion.category]}</p> : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Link href={`/stock/${item.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"><Package size={17} />Open</Link>
                {item.active ? (
                  <>
                    <Link href={`/stock/issue?stockItemId=${item.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Issue</Link>
                    <Link href={`/stock/issue?stockItemId=${item.id}&issueType=LOAN`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Loan</Link>
                  </>
                ) : (
                  <span className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 sm:col-span-2">Archived items cannot be issued</span>
                )}
              </div>
            </article>
          );
        })}
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
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link className="font-medium text-slate-950 hover:underline" href={`/stock/${item.id}`}>{item.name}</Link>
                  <p className="text-xs text-slate-500">{item.sku || "No SKU"} / {stockCategoryLabels[item.category]}{item.active ? "" : " / Archived"}</p>
                </td>
                <td className="px-4 py-3">{stockItemTypeLabels[item.itemType]}</td>
                <td className="px-4 py-3 font-semibold">{item.quantityOnHand}</td>
                <td className="px-4 py-3">{item.minimumQuantity}</td>
                <td className="px-4 py-3">{item.storageLocation || "-"}</td>
                <td className="px-4 py-3">{item.vendorName || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/stock/${item.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Open</Link>
                    {item.active ? <Link href={`/stock/issue?stockItemId=${item.id}`} className="rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Issue</Link> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {filteredItems.length ? (
        <nav className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-600">Showing {startItem}-{endItem} of {filteredItems.length}</p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link href={stockPageHref(params, safePage - 1)} className={`inline-flex min-h-11 items-center justify-center rounded-md border px-3 font-semibold ${safePage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>Previous</Link>
            <Link href={stockPageHref(params, safePage + 1)} className={`inline-flex min-h-11 items-center justify-center rounded-md border px-3 font-semibold ${safePage >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>Next</Link>
          </div>
        </nav>
      ) : null}

      {filteredItems.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <h2 className="font-semibold text-slate-950">{q ? `No stock item found for ${q}.` : "No stock items match this view."}</h2>
          <p className="mt-1">{q ? "Generic peripherals should be added as stock before they are handed out or loaned." : "Try clearing filters or adding a stock item."}</p>
          <div className="mt-4 grid gap-2 sm:flex">
            <Link href={q ? `/stock/new?name=${encodeURIComponent(q)}` : "/stock/new"} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800">Add Stock Item</Link>
            {q ? <Link href={`/devices?q=${encodeURIComponent(q)}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100">Search serialized assets</Link> : null}
            <Link href="/stock" className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100">Clear filters</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StockSignalCard({ href, label, value, helper }: { href: string; label: string; value: number; helper: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
      <p className="mt-4 text-3xl font-semibold text-slate-950">{value}</p>
    </Link>
  );
}

function CategoryCard({ href, icon: Icon, label, helper }: { href: string; icon: ElementType; label: string; helper: string }) {
  return (
    <Link href={href} className="flex min-h-24 items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50">
      <Icon className="mt-1 shrink-0 text-slate-400" size={20} />
      <span>
        <span className="block font-semibold text-slate-950">{label}</span>
        <span className="mt-1 block text-sm text-slate-500">{helper}</span>
      </span>
    </Link>
  );
}

function stockPageHref(params: Record<string, string | string[] | undefined>, page: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value == null) continue;
    if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
    else next.set(key, value);
  }
  next.set("page", String(page));
  return `/stock?${next.toString()}`;
}
