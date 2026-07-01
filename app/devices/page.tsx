import Link from "next/link";
import type React from "react";
import { AlertTriangle, Camera, ClipboardCheck, HardDrive, Laptop, MoreHorizontal, Network, PackageCheck, Plus, Printer, ScanLine, Search, SlidersHorizontal, Smartphone, Tags, Truck, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { ActionLink, EmptyState, PageActions } from "@/components/ui-patterns";
import { categoryLabels, categoryOptions, conditionLabels, conditionOptions, conditionTone, statusLabels, statusOptions, statusTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";
import { getAssetCategoryLabel, getAssetDisplayName, getAssetIdentityLine, shouldShowNetworkSummary } from "@/lib/asset-display";
import { buildInventoryOverview, buildInventorySignals, filterInventoryAssets, getInventoryReviewReasons, inventoryViewOptions, isStrongInventorySearchMatch, normalizeInventoryView, paginateInventory, shouldShowInventoryListFromParams, sortInventorySearchResults, type InventoryAsset } from "@/lib/inventory-views";
import { isAssetLikeAssignedValue, mobilePairingStatus } from "@/lib/mobile-legacy";
import { installActionLabel, isInstallEligibleAsset } from "@/lib/equipment-install";
import { isMoveUsefulAsset } from "@/lib/equipment-move";
import { createTranslator } from "@/lib/i18n";
import { getLocaleFromCookies } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function DevicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const locale = await getLocaleFromCookies();
  const text = createTranslator(locale, "inventory");
  const common = createTranslator(locale, "common");
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

  const conflicts = detectInventoryConflicts(allDevices);
  const conflictedIds = new Set(conflicts.flatMap((conflict) => conflict.affectedDeviceIds ?? []));
  const signals = buildInventorySignals(allDevices);
  const overview = buildInventoryOverview(allDevices, signals);
  const currentView = normalizeInventoryView(params.view);
  const showInventoryList = shouldShowInventoryListFromParams(params);
  const viewFiltered = filterInventoryAssets(allDevices, { ...params, conflict: null }, signals);
  const devices = params.conflict ? viewFiltered.filter((device) => (params.conflict === "yes" ? conflictedIds.has(device.id) : !conflictedIds.has(device.id))) : viewFiltered;
  const isSearchMode = Boolean(params.q?.trim());
  const sortedDevices = isSearchMode ? sortInventorySearchResults(devices, params.q) : devices;
  const page = paginateInventory(sortedDevices, params.page, params.pageSize);
  const bestMatch = isSearchMode ? page.items.find((device) => isStrongInventorySearchMatch(device, params.q)) : null;
  const vlans = [...new Set(allDevices.map((device) => device.vlan).filter((vlan): vlan is number => vlan != null))].sort((a, b) => a - b);
  const showNetworkColumn = currentView === "network";

  const activeFilters = [
    currentView !== "all" ? inventoryViewOptions.find((option) => option.id === currentView)?.label : null,
    params.q ? `Search: ${params.q}` : null,
    params.category ? categoryLabels[params.category as keyof typeof categoryLabels] : null,
    params.status ? statusLabels[params.status as keyof typeof statusLabels] : null,
    params.condition ? conditionLabels[params.condition as keyof typeof conditionLabels] : null,
    params.vlan ? `VLAN ${params.vlan}` : null,
    params.employee ? `User: ${params.employee}` : null,
    params.location ? `Location: ${params.location}` : null,
    params.assigned ? (params.assigned === "yes" ? text("tableAssignedLocation").split(" / ")[0] : common("unassigned")) : null,
    params.hasIp ? (params.hasIp === "yes" ? text("hasIp") : text("noIp")) : null,
    params.hasMac ? (params.hasMac === "yes" ? text("hasMac") : text("noMac")) : null,
    params.conflict ? (params.conflict === "yes" ? text("hasConflict") : text("noConflict")) : null,
    params.missingPhotos === "true" ? common("missingPhotos") : null,
    params.needsReview === "true" ? common("needsReview") : null,
    params.loaned === "true" ? text("loanedOut") : null,
    params.inRma === "true" ? text("inRma") : null,
    params.missingLost === "true" ? text("missingLost") : null,
    params.retired === "true" ? text("retired") : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title={text("title")}
        description={text("description")}
        action={
          <PageActions>
            <ActionLink href="/scan">
              <ScanLine size={16} />
              {text("scanLabel")}
            </ActionLink>
            <ActionLink href="/intake/assets/new" variant="primary">
              <Plus size={16} />
              {text("addAsset")}
            </ActionLink>
          </PageActions>
        }
      />

      <form className={`${showInventoryList ? "sticky top-[73px] z-20 lg:static" : ""} space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:p-4`}>
        {currentView !== "all" ? <input type="hidden" name="view" value={currentView} /> : null}
        {params.pageSize ? <input type="hidden" name="pageSize" value={params.pageSize} /> : null}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={16} />
            <input name="q" defaultValue={params.q ?? ""} placeholder={text("searchPlaceholder")} className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:min-h-12 sm:text-sm" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white sm:min-h-12 sm:text-sm">{common("search")}</button>
          <Link href="/scan" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12 sm:text-sm">
            <ScanLine size={16} />
            {common("scan")}
          </Link>
        </div>

        {showInventoryList && !isSearchMode ? <div className="flex gap-2 overflow-x-auto pb-1">
          {inventoryViewOptions.map((option) => (
            <Link
              key={option.id}
              href={devicesHref(params, { view: option.id === "all" ? undefined : option.id, list: option.id === "all" ? "true" : undefined, page: undefined })}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${
                currentView === option.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div> : null}

        {showInventoryList && activeFilters.length ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {filter}
              </span>
            ))}
            <Link href="/devices" className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
              {common("clearFilters")}
            </Link>
          </div>
        ) : null}

        {showInventoryList && !isSearchMode ? <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal size={16} />
              {text("filters")}
            </span>
            <span className="text-xs text-slate-500">{activeFilters.length ? common("activeCount", { count: activeFilters.length }) : common("optional")}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-3 xl:grid-cols-6">
            <select name="category" defaultValue={params.category ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("allCategories")}</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={params.status ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("allStatuses")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            <select name="condition" defaultValue={params.condition ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("allConditions")}</option>
              {conditionOptions.map((condition) => (
                <option key={condition} value={condition}>
                  {conditionLabels[condition]}
                </option>
              ))}
            </select>
            <select name="assigned" defaultValue={params.assigned ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("assignedState")}</option>
              <option value="yes">{text("tableAssignedLocation").split(" / ")[0]}</option>
              <option value="no">{common("unassigned")}</option>
            </select>
            <select name="hasIp" defaultValue={params.hasIp ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("ipState")}</option>
              <option value="yes">{text("hasIp")}</option>
              <option value="no">{text("noIp")}</option>
            </select>
            <select name="hasMac" defaultValue={params.hasMac ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("macState")}</option>
              <option value="yes">{text("hasMac")}</option>
              <option value="no">{text("noMac")}</option>
            </select>
            <select name="vlan" defaultValue={params.vlan ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("allVlans")}</option>
              {vlans.map((vlan) => (
                <option key={vlan} value={vlan}>
                  VLAN {vlan}
                </option>
              ))}
            </select>
            <select name="conflict" defaultValue={params.conflict ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
              <option value="">{text("conflictStatus")}</option>
              <option value="yes">{text("hasConflict")}</option>
              <option value="no">{text("noConflict")}</option>
            </select>
            <input name="employee" defaultValue={params.employee ?? ""} placeholder={text("assignedUser")} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
            <input name="location" defaultValue={params.location ?? ""} placeholder={text("locationArea")} className="min-h-12 rounded-md border border-slate-300 px-3 text-base sm:text-sm" />
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="needsReview" value="true" type="checkbox" defaultChecked={params.needsReview === "true"} />
              {common("needsReview")}
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="missingPhotos" value="true" type="checkbox" defaultChecked={params.missingPhotos === "true"} />
              {common("missingPhotos")}
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="loaned" value="true" type="checkbox" defaultChecked={params.loaned === "true"} />
              {text("loanedOut")}
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="inRma" value="true" type="checkbox" defaultChecked={params.inRma === "true"} />
              {text("inRma")}
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="missingLost" value="true" type="checkbox" defaultChecked={params.missingLost === "true"} />
              {text("missingLost")}
            </label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700">
              <input name="retired" value="true" type="checkbox" defaultChecked={params.retired === "true"} />
              {text("retired")}
            </label>
            <button className="min-h-12 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white md:col-span-3 xl:col-span-6 sm:text-sm">{common("applyFilters")}</button>
          </div>
        </details> : null}
      </form>

      {showInventoryList && isSearchMode ? <InventoryResultsSection currentView={currentView} params={params} page={page} signals={signals} conflictedIds={conflictedIds} showNetworkColumn={showNetworkColumn} bestMatch={bestMatch} text={text} common={common} /> : null}

      {!isSearchMode ? <section className="space-y-3">
        <SectionTitle title={text("assetGroups")} description={text("assetGroupsDescription")} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InventoryCard href="/inventory/laptops" icon={<Laptop size={18} />} label="Laptops / Desktops" count={overview.groups.laptops} helper="Workstations and laptop fleet" />
          <InventoryCard href="/inventory/mobile" icon={<Smartphone size={18} />} label="Mobile Devices" count={overview.groups.mobile} helper="iPods, iPhones, iPads, phones, tablets" />
          <InventoryCard href="/inventory/printers" icon={<Printer size={18} />} label="Printers" count={overview.groups.printers} helper="MFPs and thermal printers" />
          <InventoryCard href="/inventory/scales" icon={<PackageCheck size={18} />} label="Scales" count={overview.groups.scales} helper="Warehouse scales and fixed weighing equipment" />
          <InventoryCard href="/inventory/scanners" icon={<ScanLine size={18} />} label="Scanners" count={overview.groups.scanners} helper="Zebra scanners and bases" />
          <InventoryCard href="/inventory/monitors" icon={<HardDrive size={18} />} label="Monitors" count={overview.groups.monitors} helper="Displays and screens" />
          <InventoryCard href="/inventory/network" icon={<Network size={18} />} label="Network / Infrastructure" count={overview.groups.network} helper="APs, switches, cameras, NVRs" />
          <InventoryCard href="/devices?category=OTHER" icon={<MoreHorizontal size={18} />} label="Accessories / Other" count={overview.groups.accessories} helper="Docking stations and uncategorized assets" />
          <InventoryCard href="/labels" icon={<Tags size={18} />} label="Generate Labels" count={overview.total} helper="QR/barcode labels for asset tags" />
          <InventoryCard href="/audits" icon={<ClipboardCheck size={18} />} label="Physical Audit" count={overview.total} helper="Cycle count an area by scanning labels" />
        </div>
      </section> : null}

      {!isSearchMode ? <section className="space-y-3">
        <SectionTitle title={text("workflowViews")} description={text("workflowViewsDescription")} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InventoryCard href="/inventory/assigned" label="Assigned" count={overview.workflows.assigned} helper="Assets currently tied to people" />
          <InventoryCard href="/inventory/available" label="Available" count={overview.workflows.available} helper="Ready to issue or deploy" />
          <InventoryCard href="/inventory/loaned" label="Loaned Out" count={overview.workflows.loaned} helper="Serialized asset loans" />
          <InventoryCard href="/inventory/rma" label="In RMA / Repair" count={overview.workflows.rma} helper="Repair and RMA workflow" />
          <InventoryCard href="/inventory/missing" label="Missing / Lost" count={overview.workflows.missingLost} helper="Assets that need recovery decisions" />
          <InventoryCard href="/inventory/retired" label="Retired" count={overview.workflows.retired} helper="History preserved, not daily inventory" />
          <InventoryCard href="/inventory/needs-review" icon={<AlertTriangle size={18} />} label="Needs Review" count={overview.workflows.needsReview} helper="Dirty imports, missing fields, conflicts" tone="warn" />
          <InventoryCard href="/inventory/missing-photos" icon={<Camera size={18} />} label="Missing Photos" count={overview.workflows.missingPhotos} helper="Required photo checklist gaps" tone="warn" />
        </div>
      </section> : null}

      {!isSearchMode ? <section className="space-y-3">
        <SectionTitle title={text("networkViews")} description={text("networkViewsDescription")} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InventoryCard href="/inventory/network?hasIp=yes" icon={<Network size={18} />} label="Assets with IP" count={overview.network.withIp} helper="Static, printer, scale, and network candidates" />
          <InventoryCard href="/inventory/network?hasMac=yes" icon={<Network size={18} />} label="Assets with MAC" count={overview.network.withMac} helper="Hardware identifiers for networked devices" />
          <InventoryCard href="/inventory/network?conflict=yes" icon={<AlertTriangle size={18} />} label="Duplicate IPs" count={overview.network.duplicateIps} helper="IP conflicts to review manually" tone="warn" />
          <InventoryCard href="/inventory/network" icon={<Wrench size={18} />} label="Static Candidates" count={overview.network.staticCandidates} helper={`${overview.network.fixedMissingIpMac} may need IP/MAC review`} />
        </div>
      </section> : null}

      {!showInventoryList ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          {text("rawListPrompt")} <Link href="/devices?list=true" className="font-semibold text-slate-950 hover:underline">{text("allAssets")}</Link>.
        </section>
      ) : null}

      {showInventoryList && !isSearchMode ? <InventoryResultsSection currentView={currentView} params={params} page={page} signals={signals} conflictedIds={conflictedIds} showNetworkColumn={showNetworkColumn} text={text} common={common} /> : null}

      {isSearchMode ? (
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-slate-800">{text("browseCategories")}</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <InventoryCard href="/inventory/laptops" icon={<Laptop size={18} />} label="Laptops / Desktops" count={overview.groups.laptops} helper="Workstations and laptop fleet" />
            <InventoryCard href="/inventory/mobile" icon={<Smartphone size={18} />} label="Mobile Devices" count={overview.groups.mobile} helper="iPods, iPhones, iPads, phones, tablets" />
            <InventoryCard href="/inventory/printers" icon={<Printer size={18} />} label="Printers" count={overview.groups.printers} helper="MFPs and thermal printers" />
            <InventoryCard href="/inventory/needs-review" icon={<AlertTriangle size={18} />} label="Needs Review" count={overview.workflows.needsReview} helper="Dirty imports, missing fields, conflicts" tone="warn" />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function InventoryResultsSection({
  currentView,
  params,
  page,
  signals,
  conflictedIds,
  showNetworkColumn,
  bestMatch,
  text,
  common,
}: {
  currentView: string;
  params: Record<string, string | undefined>;
  page: ReturnType<typeof paginateInventory<InventoryAsset>>;
  signals: ReturnType<typeof buildInventorySignals>;
  conflictedIds: Set<string>;
  showNetworkColumn: boolean;
  bestMatch?: InventoryAsset | null;
  text: ReturnType<typeof createTranslator>;
  common: ReturnType<typeof createTranslator>;
}) {
  const isSearchMode = Boolean(params.q?.trim());
  return (
    <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle title={isSearchMode ? text("searchResults") : currentView === "all" ? text("inventoryList") : `${inventoryViewOptions.find((option) => option.id === currentView)?.label} assets`} description={isSearchMode ? text("showingSearch", { start: page.startNumber, end: page.endNumber, total: page.totalItems, query: params.q ?? "" }) : text("showingAssets", { start: page.startNumber, end: page.endNumber, total: page.totalItems, pageSize: page.pageSize })} />
          <div className="flex gap-2">
            <PageLink disabled={page.page <= 1} href={devicesHref(params, { page: String(page.page - 1) })}>
              {common("previous")}
            </PageLink>
            <PageLink disabled={page.page >= page.totalPages} href={devicesHref(params, { page: String(page.page + 1) })}>
              {common("next")}
            </PageLink>
          </div>
        </div>

        {bestMatch ? <BestMatchCard device={bestMatch} text={text} common={common} /> : null}

        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{text("tableAsset")}</th>
                <th className="px-4 py-3">{text("tableTag")}</th>
                <th className="px-4 py-3">{text("tableCategory")}</th>
                <th className="px-4 py-3">{text("tableStatus")}</th>
                <th className="px-4 py-3">{text("tableAssignedLocation")}</th>
                {showNetworkColumn ? <th className="px-4 py-3">{text("tableNetwork")}</th> : null}
                <th className="px-4 py-3">{text("tableAttention")}</th>
                <th className="px-4 py-3">{text("tableActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.items.map((device) => {
                const reviewReasons = getInventoryReviewReasons(device, signals);
                const assignedLabel = device.employee?.fullName || (device.assignedTo && !isAssetLikeAssignedValue(device.assignedTo) ? device.assignedTo : null) || common("unassigned");
                const pairing = currentView === "mobile" ? mobilePairingStatus(device) : "";
                return (
                  <tr key={device.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/devices/${device.id}`} className="font-semibold text-slate-950 hover:underline">
                        {getAssetDisplayName(device)}
                      </Link>
                      <p className="text-xs text-slate-500">{getAssetIdentityLine(device)}</p>
                    </td>
                    <td className="px-4 py-3 font-mono">{device.assetTag || "-"}</td>
                    <td className="px-4 py-3">{getAssetCategoryLabel(device)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge className={statusClass(device.status)}>{statusLabel(device.status)}</Badge>
                        <Badge className={conditionClass(device.condition)}>{conditionLabel(device.condition)}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{assignedLabel}</p>
                      <p className="text-xs text-slate-500">{device.location || device.areaDepartment || common("noLocation")}</p>
                      {pairing ? <p className="mt-1 text-xs font-semibold text-amber-700">{pairing}</p> : null}
                    </td>
                    {showNetworkColumn ? (
                      <td className="px-4 py-3 font-mono text-xs">
                        <p>{device.ipAddress || text("noIp")}</p>
                        <p>{device.macAddress || text("noMacTracked")}</p>
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <AttentionBadges deviceId={device.id} reviewReasons={reviewReasons} conflict={conflictedIds.has(device.id)} missingPhotos={signals.missingPhotoIds.has(device.id)} common={common} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <DeviceActions device={device} missingPhotos={signals.missingPhotoIds.has(device.id)} text={text} common={common} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 lg:hidden">
          {page.items.map((device) => {
            const reviewReasons = getInventoryReviewReasons(device, signals);
            const showNetwork = shouldShowNetworkSummary(device, currentView);
            const assignedLabel = device.employee?.fullName || (device.assignedTo && !isAssetLikeAssignedValue(device.assignedTo) ? device.assignedTo : null) || common("unassigned");
            const pairing = currentView === "mobile" ? mobilePairingStatus(device) : "";
            return (
              <article key={device.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold text-slate-950">{getAssetDisplayName(device)}</h2>
                    <p className="font-mono text-sm text-slate-600">{device.assetTag || device.serialNumber || common("noTag")}</p>
                  </div>
                  <Badge className={statusClass(device.status)}>{statusLabel(device.status)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span>{getAssetCategoryLabel(device)}</span>
                  <Badge className={conditionClass(device.condition)}>{conditionLabel(device.condition)}</Badge>
                  {device.model ? <span>{device.model}</span> : null}
                  {showNetwork && device.ipAddress ? <span className="font-mono">{device.ipAddress}</span> : null}
                  {showNetwork && device.macAddress ? <span className="font-mono">{device.macAddress}</span> : null}
                  <span>{device.location || device.areaDepartment || common("noLocation")}</span>
                  <span>{assignedLabel}</span>
                  {pairing ? <Badge className="bg-amber-100 text-amber-800 ring-amber-200">{pairing}</Badge> : null}
                </div>
                <AttentionBadges deviceId={device.id} reviewReasons={reviewReasons} conflict={conflictedIds.has(device.id)} missingPhotos={signals.missingPhotoIds.has(device.id)} common={common} compact />
                <DeviceActions device={device} missingPhotos={signals.missingPhotoIds.has(device.id)} text={text} common={common} mobile />
              </article>
            );
          })}
        </div>

        {page.items.length === 0 ? <EmptyState title={text("noAssetsTitle")} description={text("noAssetsDescription")} action={<ActionLink href="/devices">{common("clearFilters")}</ActionLink>} /> : null}

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {text("showingRange", { start: page.startNumber, end: page.endNumber, total: page.totalItems })}
          </span>
          <div className="flex gap-2">
            <PageLink disabled={page.page <= 1} href={devicesHref(params, { page: String(page.page - 1) })}>
              {common("previous")}
            </PageLink>
            <PageLink disabled={page.page >= page.totalPages} href={devicesHref(params, { page: String(page.page + 1) })}>
              {common("next")}
            </PageLink>
          </div>
        </div>
      </section>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}

function InventoryCard({ href, icon, label, count, helper, tone = "default" }: { href: string; icon?: React.ReactNode; label: string; count: number; helper: string; tone?: "default" | "warn" }) {
  return (
    <Link href={href} className={`block rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">{icon ?? <HardDrive size={18} />}</div>
        <span className="text-2xl font-semibold text-slate-950">{count.toLocaleString()}</span>
      </div>
      <h3 className="mt-3 font-semibold text-slate-950">{label}</h3>
      <p className="mt-1 text-sm text-slate-600">{helper}</p>
    </Link>
  );
}

function AttentionBadges({ deviceId, reviewReasons, conflict, missingPhotos, common, compact = false }: { deviceId: string; reviewReasons: string[]; conflict: boolean; missingPhotos: boolean; common: ReturnType<typeof createTranslator>; compact?: boolean }) {
  const rawBadges = [
    conflict ? common("conflict") : null,
    ...reviewReasons.map((reason) => reason.replace(/\.$/, "").replace("Missing required photos", common("missingPhotos"))),
    missingPhotos ? common("missingPhotos") : null,
  ].filter((value): value is string => Boolean(value));
  const badges = [...new Set(rawBadges)];
  const visible = badges.slice(0, compact ? 3 : 3);
  const hiddenCount = Math.max(0, badges.length - visible.length);
  if (!badges.length) return <span className={compact ? "mt-3 block text-xs text-slate-500" : "text-xs text-slate-500"}>{common("noReviewFlags")}</span>;
  return (
    <div className={`${compact ? "mt-3" : ""} flex flex-wrap gap-1`}>
      {visible.map((badge) => (
        <Link key={`${deviceId}-${badge}`} href="/devices?view=needs-review" className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          {badge}
        </Link>
      ))}
      {hiddenCount ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{common("moreCount", { count: hiddenCount })}</span> : null}
    </div>
  );
}

function BestMatchCard({ device, text, common }: { device: InventoryAsset; text: ReturnType<typeof createTranslator>; common: ReturnType<typeof createTranslator> }) {
  return (
    <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{text("bestMatch")}</p>
          <h2 className="break-words text-lg font-semibold text-slate-950">{getAssetDisplayName(device)}</h2>
          <p className="font-mono text-sm text-slate-700">{device.assetTag || device.serialNumber || common("noTag")}</p>
          <p className="mt-1 text-sm text-slate-600">{getAssetIdentityLine(device)}</p>
        </div>
        <Link href={`/devices/${device.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          {text("openBestMatch")}
        </Link>
      </div>
    </article>
  );
}

function DeviceActions({ device, missingPhotos, text, common, mobile = false }: { device: InventoryAsset; missingPhotos: boolean; text: ReturnType<typeof createTranslator>; common: ReturnType<typeof createTranslator>; mobile?: boolean }) {
  const installEligible = isInstallEligibleAsset(device);
  const moveUseful = isMoveUsefulAsset(device);
  return (
    <div className={`grid gap-2 ${mobile ? "mt-4 grid-cols-2" : "sm:flex sm:flex-wrap"}`}>
      <Link href={`/devices/${device.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
        {common("open")}
      </Link>
      {moveUseful ? (
        <Link href={`/devices/${device.id}/move`} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-3 text-sm font-semibold text-sky-900 hover:bg-sky-100">
          <Truck size={15} />
          {text("move")}
        </Link>
      ) : null}
      {installEligible ? (
        <Link href={`/devices/${device.id}/install`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100">
          {installActionLabel(device)}
        </Link>
      ) : null}
      {missingPhotos ? (
        <Link href={`/devices/${device.id}#photos`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
          {text("addPhoto")}
        </Link>
      ) : null}
      <Link href={`/tasks/new?relatedDeviceId=${device.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
        {text("task")}
      </Link>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-400">{children}</span>;
  return (
    <Link href={href} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
      {children}
    </Link>
  );
}

function devicesHref(current: Record<string, string | undefined>, updates: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  if (!("page" in updates)) params.delete("page");
  const query = params.toString();
  return query ? `/devices?${query}` : "/devices";
}

function statusLabel(value: string) {
  return statusLabels[value as keyof typeof statusLabels] ?? value.replaceAll("_", " ");
}

function statusClass(value: string) {
  return statusTone[value as keyof typeof statusTone] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

function conditionLabel(value?: string | null) {
  if (!value) return "Unknown";
  return conditionLabels[value as keyof typeof conditionLabels] ?? value.replaceAll("_", " ");
}

function conditionClass(value?: string | null) {
  if (!value) return "bg-slate-100 text-slate-700 ring-slate-200";
  return conditionTone[value as keyof typeof conditionTone] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}
