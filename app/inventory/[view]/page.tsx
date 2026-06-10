import Link from "next/link";
import { notFound } from "next/navigation";
import type React from "react";
import { ArrowLeft, Plus, ScanLine, Search, SlidersHorizontal, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { ActionLink, EmptyState, PageActions } from "@/components/ui-patterns";
import { categoryLabels, categoryOptions, conditionLabels, conditionOptions, conditionTone, statusLabels, statusOptions, statusTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";
import { getAssetCategoryLabel, getAssetDisplayName, getAssetIdentityLine, shouldShowNetworkSummary } from "@/lib/asset-display";
import { buildInventorySignals, filterInventoryAssets, getInventoryReviewReasons, inventoryRouteViews, isLoanedAsset, isRmaAsset, normalizeInventoryView, paginateInventory, sortInventorySearchResults, type InventoryAsset } from "@/lib/inventory-views";
import { isAssetLikeAssignedValue, mobilePairingStatus } from "@/lib/mobile-legacy";
import { installActionLabel, isInstallEligibleAsset } from "@/lib/equipment-install";
import { isMoveUsefulAsset } from "@/lib/equipment-move";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ view: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

const viewCopy: Record<string, { title: string; description: string; helper: string }> = {
  laptops: { title: "Laptops / Desktops", description: "Workstations and laptops for long-term assignment, loan, repair, and photo review.", helper: "Focus on assignment state, serials, location, and compliance flags." },
  mobile: { title: "Mobile Devices", description: "iPods, iPhones, iPads, phones, and tablets without network/IPAM noise by default.", helper: "Shows assignment/RMA state and light iPod/sled pairing status." },
  printers: { title: "Printers", description: "MFP and thermal printers with maintenance, IP, and photo compliance signals.", helper: "IP and maintenance details are shown where they exist." },
  scales: { title: "Scales", description: "Warehouse scales and fixed weighing assets, including static/IP candidates.", helper: "Location, serial, IP/MAC, and review flags stay visible." },
  scanners: { title: "Scanners", description: "Scanner assets, Zebra devices, and scanner-base related inventory.", helper: "Useful for availability, assignment, loan, RMA, and photo follow-up." },
  monitors: { title: "Monitors", description: "Display inventory with assignment and photo compliance context.", helper: "Daily browsing stays simple: tag, serial, location, status." },
  network: { title: "Network / Infrastructure", description: "APs, switches, cameras, NVRs, and fixed/static network candidates.", helper: "This is the one inventory view where IP, MAC, and VLAN are prominent." },
  assigned: { title: "Assigned Assets", description: "Assets currently tied to employees or active assignment items.", helper: "For assignment records and returns, open the Assignments module." },
  available: { title: "Available Assets", description: "Assets ready to deploy, assign, or prepare for use.", helper: "Filtered to available/active/reserved assets that are not currently assigned." },
  loaned: { title: "Loaned Out Assets", description: "Serialized assets currently checked out through the asset loan workflow.", helper: "Open the asset or linked loan to receive items back." },
  rma: { title: "RMA / Repair Assets", description: "Assets currently in repair, RMA, or pending RMA return.", helper: "Open the asset or RMA record for receive/close actions." },
  missing: { title: "Missing / Lost Assets", description: "Assets marked missing or lost for recovery and review.", helper: "Keep this separate from daily browsing so normal pages stay calm." },
  retired: { title: "Retired Assets", description: "Retired and disposed assets kept for history and audit.", helper: "These are preserved records, not daily assignment candidates." },
  "needs-review": { title: "Needs Review", description: "Data cleanup view for suspicious imports, missing fields, conflicts, and mismatches.", helper: "Shows full review reasons instead of compressed daily badges." },
  "missing-photos": { title: "Missing Required Photos", description: "Photo compliance workflow for assets missing overview, asset tag, serial, condition, or location photos.", helper: "Open each asset and jump to photos to close checklist gaps." },
};

export default async function InventoryCategoryPage({ params, searchParams }: Props) {
  const { view: rawView } = await params;
  const query = await searchParams;
  const view = normalizeInventoryView(rawView);
  if (view === "all" || !inventoryRouteViews.includes(view)) notFound();

  const allDevices = await prisma.device.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    include: {
      ipRange: true,
      employee: { select: { fullName: true, employeeId: true } },
      photos: { select: { photoType: true, isPrimary: true } },
      assignmentItems: { select: { returnedAt: true } },
      rmaItems: { select: { result: true, returnedAt: true, rmaCase: { select: { id: true, status: true, rmaNumber: true } } } },
      assetLoanItems: { select: { returnStatus: true, returnedAt: true, loan: { select: { id: true, status: true, loanNumber: true } } } },
      sourceRelationships: { select: { relationshipType: true, status: true, targetDeviceId: true } },
      targetRelationships: { select: { relationshipType: true, status: true, sourceDeviceId: true } },
      aliases: { select: { aliasType: true, value: true } },
    },
  });

  const signals = buildInventorySignals(allDevices);
  const conflicts = detectInventoryConflicts(allDevices);
  const conflictedIds = new Set(conflicts.flatMap((conflict) => conflict.affectedDeviceIds ?? []));
  const viewAssets = filterInventoryAssets(allDevices, { view }, signals);
  const baseFiltered = filterInventoryAssets(allDevices, { ...query, view, conflict: null }, signals);
  const devices = query.conflict ? baseFiltered.filter((device) => (query.conflict === "yes" ? conflictedIds.has(device.id) : !conflictedIds.has(device.id))) : baseFiltered;
  const isSearchMode = Boolean(query.q?.trim());
  const sortedDevices = isSearchMode ? sortInventorySearchResults(devices, query.q) : devices;
  const page = paginateInventory(sortedDevices, query.page, query.pageSize);
  const copy = viewCopy[view];
  const activeFilters = activeFilterLabels(query, view);
  const showNetworkColumn = view === "network";
  const summary = buildViewSummary(view, viewAssets, signals);

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={
          <PageActions>
            <ActionLink href="/devices">
              <ArrowLeft size={16} />
              Inventory
            </ActionLink>
            <ActionLink href="/scan">
              <ScanLine size={16} />
              Scan
            </ActionLink>
            <ActionLink href="/devices/new" variant="primary">
              <Plus size={16} />
              Add asset
            </ActionLink>
          </PageActions>
        }
      />

      {!isSearchMode ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total" value={viewAssets.length} />
        <SummaryCard label="Assigned" value={view === "assigned" ? viewAssets.length : viewAssets.filter((asset) => asset.employee || asset.status === "IN_USE_ASSIGNED").length} />
        <SummaryCard label="Available" value={viewAssets.filter((asset) => ["AVAILABLE", "ACTIVE", "RESERVED"].includes(asset.status)).length} />
        <SummaryCard label={summary.extraLabel} value={summary.extraValue} />
        <SummaryCard label="Needs review" value={viewAssets.filter((asset) => getInventoryReviewReasons(asset, signals).length > 0).length} />
      </section> : null}

      <form className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={16} />
            <input name="q" defaultValue={query.q ?? ""} placeholder={`Search within ${copy.title.toLowerCase()}`} className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white sm:min-h-12 sm:text-sm">Search</button>
          <Link href={query.q ? `/devices?q=${encodeURIComponent(query.q)}` : "/devices"} className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12 sm:text-sm">
            Search all inventory
          </Link>
        </div>
        {!isSearchMode ? <div className="flex gap-2 overflow-x-auto pb-1">
          {quickFilterLinks(view).map((filter) => (
            <Link key={filter.label} href={inventoryHref(view, query, filter.params)} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              {filter.label}
            </Link>
          ))}
        </div> : null}
        {activeFilters.length ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filter}</span>)}
            <Link href={`/inventory/${view}`} className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">Clear filters</Link>
          </div>
        ) : null}
        {!isSearchMode ? <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Filters</span>
            <span className="text-xs text-slate-500">{activeFilters.length ? `${activeFilters.length} active` : "Optional"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-3 xl:grid-cols-6">
            {view === "printers" ? (
              <select name="category" defaultValue={query.category ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
                <option value="">All printers</option>
                <option value="MFP_PRINTER">MFP</option>
                <option value="THERMAL_PRINTER">Thermal</option>
                <option value="OTHER_PRINTER">Other printer</option>
              </select>
            ) : view === "network" ? (
              <select name="category" defaultValue={query.category ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
                <option value="">All network categories</option>
                {["ACCESS_POINT", "SWITCH", "CAMERA", "CAMERA_NVR", "NVR", "DESKTOP", "SCALE", "THERMAL_PRINTER", "MFP_PRINTER"].map((category) => <option key={category} value={category}>{categoryLabels[category as keyof typeof categoryLabels]}</option>)}
              </select>
            ) : (
              <select name="category" defaultValue={query.category ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
                <option value="">All categories</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
              </select>
            )}
            <select name="status" defaultValue={query.status ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            <select name="condition" defaultValue={query.condition ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">All conditions</option>
              {conditionOptions.map((condition) => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}
            </select>
            <select name="assigned" defaultValue={query.assigned ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">Assigned state</option>
              <option value="yes">Assigned</option>
              <option value="no">Unassigned</option>
            </select>
            <select name="hasIp" defaultValue={query.hasIp ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">IP state</option>
              <option value="yes">Has IP</option>
              <option value="no">No IP</option>
            </select>
            <select name="hasMac" defaultValue={query.hasMac ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">MAC state</option>
              <option value="yes">Has MAC</option>
              <option value="no">No MAC</option>
            </select>
            <input name="location" defaultValue={query.location ?? ""} placeholder="Location / area" className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="missingPhotos" value="true" type="checkbox" defaultChecked={query.missingPhotos === "true"} />
              Missing photos
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="needsReview" value="true" type="checkbox" defaultChecked={query.needsReview === "true"} />
              Needs review
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="conflict" value="yes" type="checkbox" defaultChecked={query.conflict === "yes"} />
              Duplicate/conflict
            </label>
            <button className="min-h-12 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white md:col-span-3 xl:col-span-6 sm:text-sm">Apply filters</button>
          </div>
        </details> : null}
      </form>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">{isSearchMode ? "Search results" : `${copy.title} list`}</h2>
            <p className="text-sm text-slate-500">{isSearchMode ? `Showing matches for "${query.q}" inside ${copy.title}. Exact tags, labels, and serials are ranked first.` : copy.helper}</p>
            <p className="text-xs text-slate-500">Showing {page.startNumber}-{page.endNumber} of {page.totalItems}</p>
          </div>
          <div className="flex gap-2">
            <PageLink disabled={page.page <= 1} href={inventoryHref(view, query, { page: String(page.page - 1) })}>Previous</PageLink>
            <PageLink disabled={page.page >= page.totalPages} href={inventoryHref(view, query, { page: String(page.page + 1) })}>Next</PageLink>
          </div>
        </div>

        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned / Location</th>
                {showNetworkColumn ? <th className="px-4 py-3">Network</th> : null}
                <th className="px-4 py-3">Attention</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.items.map((asset) => {
                const reasons = getInventoryReviewReasons(asset, signals);
                const assignedLabel = asset.employee?.fullName || (asset.assignedTo && !isAssetLikeAssignedValue(asset.assignedTo) ? asset.assignedTo : null) || "Unassigned";
                return (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/devices/${asset.id}`} className="font-semibold text-slate-950 hover:underline">{getAssetDisplayName(asset)}</Link>
                      <p className="text-xs text-slate-500">{getAssetIdentityLine(asset)}</p>
                    </td>
                    <td className="px-4 py-3 font-mono">{asset.assetTag || "-"}</td>
                    <td className="px-4 py-3">{getAssetCategoryLabel(asset)}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Badge className={statusClass(asset.status)}>{statusLabel(asset.status)}</Badge><Badge className={conditionClass(asset.condition)}>{conditionLabel(asset.condition)}</Badge></div></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{assignedLabel}</p>
                      <p className="text-xs text-slate-500">{asset.location || asset.areaDepartment || "No location"}</p>
                      {view === "mobile" ? <p className="mt-1 text-xs font-semibold text-amber-700">{mobilePairingStatus(asset)}</p> : null}
                    </td>
                    {showNetworkColumn ? <td className="px-4 py-3 font-mono text-xs"><p>{asset.ipAddress || "No IP"}</p><p>{asset.macAddress || "No MAC"}</p>{asset.vlan ? <p>VLAN {asset.vlan}</p> : null}</td> : null}
                    <td className="px-4 py-3"><AttentionBadges assetId={asset.id} reasons={reasons} conflict={conflictedIds.has(asset.id)} missingPhotos={signals.missingPhotoIds.has(asset.id)} full={view === "needs-review" || view === "missing-photos"} /></td>
                    <td className="px-4 py-3"><RowActions asset={asset} missingPhotos={signals.missingPhotoIds.has(asset.id)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 lg:hidden">
          {page.items.map((asset) => {
            const reasons = getInventoryReviewReasons(asset, signals);
            const assignedLabel = asset.employee?.fullName || (asset.assignedTo && !isAssetLikeAssignedValue(asset.assignedTo) ? asset.assignedTo : null) || "Unassigned";
            const showNetwork = shouldShowNetworkSummary(asset, view);
            return (
              <article key={asset.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold text-slate-950">{getAssetDisplayName(asset)}</h2>
                    <p className="font-mono text-sm text-slate-600">{asset.assetTag || asset.serialNumber || "No tag"}</p>
                  </div>
                  <Badge className={statusClass(asset.status)}>{statusLabel(asset.status)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span>{getAssetCategoryLabel(asset)}</span>
                  <Badge className={conditionClass(asset.condition)}>{conditionLabel(asset.condition)}</Badge>
                  <span>{assignedLabel}</span>
                  <span>{asset.location || asset.areaDepartment || "No location"}</span>
                  {showNetwork && asset.ipAddress ? <span className="font-mono">{asset.ipAddress}</span> : null}
                  {showNetwork && asset.macAddress ? <span className="font-mono">{asset.macAddress}</span> : null}
                  {view === "mobile" ? <Badge className="bg-amber-100 text-amber-800 ring-amber-200">{mobilePairingStatus(asset)}</Badge> : null}
                  {view === "loaned" && isLoanedAsset(asset) ? <Badge className="bg-violet-100 text-violet-800 ring-violet-200">Loan active</Badge> : null}
                  {view === "rma" && isRmaAsset(asset) ? <Badge className="bg-amber-100 text-amber-900 ring-amber-200">RMA active</Badge> : null}
                </div>
                <AttentionBadges assetId={asset.id} reasons={reasons} conflict={conflictedIds.has(asset.id)} missingPhotos={signals.missingPhotoIds.has(asset.id)} full={view === "needs-review" || view === "missing-photos"} compact />
                <RowActions asset={asset} missingPhotos={signals.missingPhotoIds.has(asset.id)} mobile />
              </article>
            );
          })}
        </div>

        {page.items.length === 0 ? <EmptyState title="No assets in this view" description="Try another search term or clear the filters." action={<ActionLink href={`/inventory/${view}`}>Clear filters</ActionLink>} /> : null}
      </section>

      {isSearchMode ? (
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-slate-800">Show {copy.title} summary</summary>
          <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Total" value={viewAssets.length} />
            <SummaryCard label="Assigned" value={view === "assigned" ? viewAssets.length : viewAssets.filter((asset) => asset.employee || asset.status === "IN_USE_ASSIGNED").length} />
            <SummaryCard label="Available" value={viewAssets.filter((asset) => ["AVAILABLE", "ACTIVE", "RESERVED"].includes(asset.status)).length} />
            <SummaryCard label={summary.extraLabel} value={summary.extraValue} />
            <SummaryCard label="Needs review" value={viewAssets.filter((asset) => getInventoryReviewReasons(asset, signals).length > 0).length} />
          </section>
        </details>
      ) : null}
    </div>
  );
}

function buildViewSummary(view: string, assets: InventoryAsset[], signals: ReturnType<typeof buildInventorySignals>) {
  const missingPhotos = assets.filter((asset) => signals.missingPhotoIds.has(asset.id)).length;
  if (view === "mobile") return { extraLabel: "Pair review", extraValue: assets.filter((asset) => mobilePairingStatus(asset) !== "Paired").length };
  if (view === "printers") return { extraLabel: "With IP", extraValue: assets.filter((asset) => asset.ipAddress).length };
  if (view === "scales") return { extraLabel: "With IP", extraValue: assets.filter((asset) => asset.ipAddress).length };
  if (view === "network") return { extraLabel: "With MAC", extraValue: assets.filter((asset) => asset.macAddress).length };
  if (view === "loaned") return { extraLabel: "Active loans", extraValue: assets.filter(isLoanedAsset).length };
  if (view === "rma") return { extraLabel: "Active RMA", extraValue: assets.filter(isRmaAsset).length };
  return { extraLabel: "Missing photos", extraValue: missingPhotos };
}

function quickFilterLinks(view: string) {
  if (view === "network") return [{ label: "Has IP", params: { hasIp: "yes" } }, { label: "Has MAC", params: { hasMac: "yes" } }, { label: "Duplicate IPs", params: { conflict: "yes" } }, { label: "Missing IP", params: { hasIp: "no" } }];
  if (view === "printers") return [{ label: "MFP", params: { category: "MFP_PRINTER" } }, { label: "Thermal", params: { category: "THERMAL_PRINTER" } }, { label: "Has IP", params: { hasIp: "yes" } }, { label: "Missing photos", params: { missingPhotos: "true" } }];
  if (view === "missing-photos") return [{ label: "Laptops", params: { category: "LAPTOP" } }, { label: "Mobile", params: { category: "PHONE" } }, { label: "Printers", params: { category: "THERMAL_PRINTER" } }, { label: "Needs review", params: { needsReview: "true" } }];
  if (view === "needs-review") return [{ label: "Missing photos", params: { missingPhotos: "true" } }, { label: "Conflicts", params: { conflict: "yes" } }, { label: "Missing tag", params: { q: "No tag" } }];
  return [{ label: "Assigned", params: { assigned: "yes" } }, { label: "Unassigned", params: { assigned: "no" } }, { label: "Missing photos", params: { missingPhotos: "true" } }, { label: "Needs review", params: { needsReview: "true" } }];
}

function activeFilterLabels(query: Record<string, string | undefined>, view: string) {
  return [
    query.q ? `Search: ${query.q}` : null,
    query.category ? categoryLabel(query.category) : null,
    query.status ? statusLabel(query.status) : null,
    query.condition ? conditionLabel(query.condition) : null,
    query.assigned ? (query.assigned === "yes" ? "Assigned" : "Unassigned") : null,
    query.hasIp ? (query.hasIp === "yes" ? "Has IP" : "No IP") : null,
    query.hasMac ? (query.hasMac === "yes" ? "Has MAC" : "No MAC") : null,
    query.location ? `Location: ${query.location}` : null,
    query.conflict === "yes" ? "Conflict" : null,
    query.missingPhotos === "true" || view === "missing-photos" ? "Missing photos" : null,
    query.needsReview === "true" || view === "needs-review" ? "Needs review" : null,
  ].filter((value): value is string => Boolean(value));
}

function inventoryHref(view: string, current: Record<string, string | undefined>, updates: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) if (value) params.set(key, value);
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  if (!("page" in updates)) params.delete("page");
  const query = params.toString();
  return query ? `/inventory/${view}?${query}` : `/inventory/${view}`;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</p></div>;
}

function AttentionBadges({ assetId, reasons, conflict, missingPhotos, full = false, compact = false }: { assetId: string; reasons: string[]; conflict: boolean; missingPhotos: boolean; full?: boolean; compact?: boolean }) {
  const raw = [conflict ? "Conflict" : null, ...reasons.map((reason) => reason.replace(/\.$/, "").replace("Missing required photos", "Missing photos")), missingPhotos ? "Missing photos" : null].filter((value): value is string => Boolean(value));
  const badges = [...new Set(raw)];
  const visible = full ? badges : badges.slice(0, 3);
  const hidden = Math.max(0, badges.length - visible.length);
  if (!badges.length) return <span className={compact ? "mt-3 block text-xs text-slate-500" : "text-xs text-slate-500"}>No review flags</span>;
  return <div className={`${compact ? "mt-3" : ""} flex flex-wrap gap-1`}>{visible.map((badge) => <Link key={`${assetId}-${badge}`} href="/inventory/needs-review" className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">{badge}</Link>)}{hidden ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">+{hidden} more</span> : null}</div>;
}

function RowActions({ asset, missingPhotos, mobile = false }: { asset: InventoryAsset; missingPhotos: boolean; mobile?: boolean }) {
  const installEligible = isInstallEligibleAsset(asset);
  const moveUseful = isMoveUsefulAsset(asset);
  return (
    <div className={`grid gap-2 ${mobile ? "mt-4 grid-cols-2" : "sm:flex sm:flex-wrap"}`}>
      <Link href={`/devices/${asset.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">Open</Link>
      {moveUseful ? <Link href={`/devices/${asset.id}/move`} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-3 text-sm font-semibold text-sky-900 hover:bg-sky-100"><Truck size={15} />Move</Link> : null}
      {installEligible ? <Link href={`/devices/${asset.id}/install`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100">{installActionLabel(asset)}</Link> : null}
      {missingPhotos ? <Link href={`/devices/${asset.id}#photos`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">Add Photo</Link> : null}
      <Link href={`/tasks/new?relatedDeviceId=${asset.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Task</Link>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-400">{children}</span>;
  return <Link href={href} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">{children}</Link>;
}

function categoryLabel(value: string) { return categoryLabels[value as keyof typeof categoryLabels] ?? value.replaceAll("_", " "); }
function statusLabel(value: string) { return statusLabels[value as keyof typeof statusLabels] ?? value.replaceAll("_", " "); }
function statusClass(value: string) { return statusTone[value as keyof typeof statusTone] ?? "bg-slate-100 text-slate-700 ring-slate-200"; }
function conditionLabel(value?: string | null) { return value ? conditionLabels[value as keyof typeof conditionLabels] ?? value.replaceAll("_", " ") : "Unknown"; }
function conditionClass(value?: string | null) { return value ? conditionTone[value as keyof typeof conditionTone] ?? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-slate-100 text-slate-700 ring-slate-200"; }
