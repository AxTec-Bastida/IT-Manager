import Link from "next/link";
import { AlertTriangle, Camera, ClipboardCheck, ClipboardList, Database, Download, Map, Network, Package, ReceiptText, Scale, ShieldCheck, Smartphone, Tags, Truck, Wrench } from "lucide-react";
import { Badge } from "@/components/badge";
import { DataQualityActionButton } from "@/components/data-quality-actions";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions, SectionCard } from "@/components/ui-patterns";
import { categoryLabels, stockCategoryLabels, statusLabels } from "@/lib/constants";
import { getDataQualityReview } from "@/lib/data-quality";
import { isInstallEligibleAsset } from "@/lib/equipment-install";
import { isMoveUsefulAsset } from "@/lib/equipment-move";
import { requiredPhotoLabels } from "@/lib/photo-compliance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Review = Awaited<ReturnType<typeof getDataQualityReview>>;
type Asset = Review["missing"]["missingAssetTag"][number];
type SuspiciousStock = Review["suspiciousStock"][number];
type StockCategorySuggestion = Review["stock"]["categorySuggestions"][number];
type SuspiciousAsset = Review["suspiciousAssetNames"][number];
type PhotoReviewAsset = Review["photoCompliance"]["missingRequired"][number];
type SuspiciousAssignment = Review["suspiciousAssignments"][number];
type SledReviewAsset = Review["sledCategoryReview"][number];

export default async function DataQualityPage() {
  const [review, activeAuditCount] = await Promise.all([
    getDataQualityReview(),
    prisma.inventoryAuditSession.count({ where: { status: { in: ["ACTIVE", "REVIEW"] } } }),
  ]);
  const urgentCount = review.urgent.duplicateIps.length + review.urgent.duplicateMacs.length + review.urgent.mobileViolations.length + review.urgent.invalidIps.length + review.urgent.duplicateAssetTags.length + review.urgent.duplicateSerials.length + review.urgent.suspiciousAssetNames.length + review.urgent.suspiciousAssignments.length + review.urgent.labelAliasConflicts.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality"
        description="Review imported inventory cleanup items without changing data automatically."
        action={
          <PageActions>
            <ActionLink href="/import/legacy-sheet">Legacy Import</ActionLink>
            <ActionLink href="/tasks/new?title=Review%20imported%20inventory%20data&category=INVENTORY" variant="primary">
              <ClipboardList size={16} />
              Create Task
            </ActionLink>
          </PageActions>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={AlertTriangle} label="Urgent Review" value={urgentCount} helper={urgentCount ? "Duplicates or tracking violations found" : "No urgent blockers"} tone={urgentCount ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"} />
        <SummaryCard icon={Network} label="Duplicate IPs" value={review.duplicateIps.length} helper={review.duplicateIps.length ? "Review before relying on IPAM" : "No duplicate active IPs"} />
        <SummaryCard icon={Network} label="Duplicate MACs" value={review.duplicateMacs.length} helper={review.duplicateMacs.length ? "Review hardware address conflicts" : "No duplicate active MACs"} />
        <SummaryCard icon={ReceiptText} label="Unlinked Facturas" value={review.unlinkedFacturas.length} helper="No linked assets or stock" />
        <SummaryCard icon={ShieldCheck} label="Skipped Duplicates" value={review.skippedDuplicates.length} helper="Workbook duplicates skipped by importer" />
        <SummaryCard icon={Wrench} label="Active RMAs" value={review.totals.activeRmas} helper={`${review.totals.devicesInRma} devices currently in RMA`} />
        <SummaryCard icon={Package} label="Suspicious Stock" value={review.suspiciousStock.length} helper="Comment-like imported rows" />
        <SummaryCard icon={Camera} label="Missing Photos" value={review.photoCompliance.missingRequired.length} helper="Assets missing required photo types" />
        <SummaryCard icon={Smartphone} label="Mobile Pairing" value={review.suspiciousAssignments.length} helper="Asset-like assigned values" />
        <SummaryCard icon={Tags} label="Label Aliases" value={review.labelAliasReview.length} helper="Duplicate physical label codes" />
        <SummaryCard icon={Map} label="Map Anchors" value={review.mapHealth.activeAnchors.length} helper={`${review.mapHealth.manualPathMaps.length} manual path maps`} href="/map" />
        <SummaryCard icon={ClipboardCheck} label="Active Audits" value={activeAuditCount} helper="Cycle counts needing scan/review" href="/audits" />
      </section>

      <ReviewSection title="Map / Location Anchors" description="Map upload and location-anchor cleanup checks. These are review-only and do not change asset locations." action={<ActionLink href="/map">Open map</ActionLink>}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Map} label="Configured maps" value={review.mapHealth.totalMaps} helper={`${review.mapHealth.uploadedMaps.length} uploaded through the app`} />
          <SummaryCard icon={AlertTriangle} label="Manual path maps" value={review.mapHealth.manualPathMaps.length} helper="Legacy/public-path fallback" />
          <SummaryCard icon={Map} label="Active anchors" value={review.mapHealth.activeAnchors.length} helper="Tap/click placement points" />
          <SummaryCard icon={AlertTriangle} label="Anchors without map" value={review.mapHealth.anchorsWithoutMap.length} helper="Can still work as manual location" />
        </div>
        {review.mapHealth.manualPathMaps.length || review.mapHealth.anchorsWithoutMap.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {review.mapHealth.manualPathMaps.slice(0, 12).map((map) => (
              <MobileCard key={map.id}>
                <p className="text-sm font-semibold text-slate-500">Manual map path</p>
                <h3 className="text-lg font-semibold text-slate-950">{map.name}</h3>
                <p className="mt-1 break-all text-sm text-slate-600">{map.imageUrl}</p>
                <div className="mt-3">
                  <ActionLink href="/map">Upload replacement</ActionLink>
                </div>
              </MobileCard>
            ))}
            {review.mapHealth.anchorsWithoutMap.slice(0, 12).map((anchor) => (
              <MobileCard key={anchor.id}>
                <p className="text-sm font-semibold text-slate-500">Anchor without map</p>
                <h3 className="text-lg font-semibold text-slate-950">{anchor.displayPath || anchor.locationLabel}</h3>
                <p className="mt-1 text-sm text-slate-600">{anchor.apName}</p>
                <div className="mt-3">
                  <ActionLink href={`/map/ap-locations/${anchor.id}/edit`}>Edit anchor</ActionLink>
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="Map anchors look connected" description="Uploaded maps and active anchors are linked cleanly." />
        )}
      </ReviewSection>

      <ReviewSection
        title="Urgent Review"
        description="Items that can affect day-to-day trust in imported data."
        action={<ExportLink type="duplicate-ips" />}
      >
        {review.duplicateIps.length ? (
          <div className="grid gap-3">
            {review.duplicateIps.map((group) => (
              <MobileCard key={group.ipAddress} className="border-amber-200 bg-amber-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Duplicate IP</p>
                    <h3 className="text-xl font-semibold text-slate-950">{group.ipAddress}</h3>
                    <p className="mt-1 text-sm text-slate-600">{group.count} active/non-retired assets use this IP.</p>
                  </div>
                  <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Review duplicate IP ${group.ipAddress}`)}&category=INVENTORY`}>
                    <ClipboardList size={16} />
                    Create Task
                  </ActionLink>
                </div>
                <div className="mt-4 grid gap-2 lg:grid-cols-2">
                  {group.assets.map((asset) => <AssetMiniCard key={asset.id} asset={asset} />)}
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No duplicate active IPs" description="No active/non-retired assets are sharing the same IP address." />
        )}

        {review.urgent.duplicateMacs.length || review.urgent.mobileViolations.length || review.urgent.invalidIps.length || review.urgent.duplicateAssetTags.length || review.urgent.duplicateSerials.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            <SignalCard title="Duplicate MACs" value={review.urgent.duplicateMacs.length} href="/api/data-quality/export/duplicate-macs" />
            <SignalCard title="Mobile tracking violations" value={review.urgent.mobileViolations.length} href="/api/data-quality/export/mobile-network-violations" />
            <SignalCard title="Invalid IPs" value={review.urgent.invalidIps.length} />
            <SignalCard title="Duplicate asset tags" value={review.urgent.duplicateAssetTags.length} />
            <SignalCard title="Duplicate serials" value={review.urgent.duplicateSerials.length} />
            <SignalCard title="Duplicate physical labels" value={review.urgent.labelAliasConflicts.length} href="/api/data-quality/export/label-alias-review" />
          </div>
        ) : null}
      </ReviewSection>

      <ReviewSection
        title="Suspicious Stock / Imported Comment Rows"
        description="Stock rows that look like legacy comments or tasks. Cleanup is archive-only and only allowed when the item is unused and quantity is 0."
        action={
          <PageActions>
            <ExportLink type="suspicious-stock-comments" />
            <ExportLink type="stock-cleanup-review" label="Cleanup CSV" />
          </PageActions>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Package} label="Flagged rows" value={review.suspiciousStock.length} helper="Review before cleanup" />
          <SummaryCard icon={ShieldCheck} label="Safe to archive" value={review.suspiciousStock.filter((item) => item.canArchive).length} helper="Unused, quantity 0, no links" />
          <SummaryCard icon={AlertTriangle} label="Not archived" value={review.suspiciousStock.filter((item) => !item.canArchive).length} helper="Has data that blocks cleanup" />
          <SummaryCard icon={Download} label="CSV" value="Ready" helper="Export review list" />
        </div>
        {review.suspiciousStock.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {review.suspiciousStock.slice(0, 24).map((item) => <SuspiciousStockCard key={item.id} item={item} />)}
          </div>
        ) : (
          <EmptyState title="No suspicious stock comments" description="No active stock names matched imported comment/task patterns." />
        )}
      </ReviewSection>

      <ReviewSection title="Suspicious Asset Names" description="Laptop and device records whose display names look like bad legacy mapping, such as Access Point on Dell Latitude laptops." action={<ExportLink type="suspicious-asset-names" />}>
        {review.suspiciousAssetNames.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {review.suspiciousAssetNames.slice(0, 24).map((asset) => <SuspiciousAssetNameCard key={asset.id} asset={asset} />)}
          </div>
        ) : (
          <EmptyState title="No suspicious Access Point names" description="No laptop/mobile/desktop assets are currently flagged with Access Point-style names." />
        )}
      </ReviewSection>

      <ReviewSection title="Photo Compliance / Missing Required Photos" description="Review required photo coverage, thumbnail health, and stock photo gaps. This does not block workflows yet." action={<div className="grid gap-2 sm:flex"><ActionLink href="/photos/compliance">Open photo queue</ActionLink><ExportLink type="missing-required-photos" /></div>}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Camera} label="Total assets" value={review.photoCompliance.totalAssets} helper="Serialized inventory records" />
          <SummaryCard icon={AlertTriangle} label="No photos" value={review.photoCompliance.assetsWithNoPhotos.length} helper="Need first photo set" />
          <SummaryCard icon={Camera} label="Missing overview" value={review.photoCompliance.missingOverview.length} helper="Overview/Main missing" />
          <SummaryCard icon={Camera} label="Fixed missing location" value={review.photoCompliance.fixedMissingLocation.length} helper="Installed-location photo missing" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SignalCard title="Missing asset tag photo" value={review.photoCompliance.missingAssetTag.length} />
          <SignalCard title="Missing serial label photo" value={review.photoCompliance.missingSerialLabel.length} />
          <SignalCard title="Missing condition photo" value={review.photoCompliance.missingCondition.length} />
          <SignalCard title="RMA/repair missing condition" value={review.photoCompliance.rmaRepairMissingCondition.length} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SignalCard title="Photos missing thumbnails" value={review.photoCompliance.photosMissingThumbnails.length} />
          <SignalCard title="Oversized photos" value={review.photoCompliance.oversizedPhotos.length} />
          <SignalCard title="Stock items with no photos" value={review.stockPhotoCompliance.stockItemsWithNoPhotos.length} />
          <SignalCard title="Photo queue items" value={review.photoCompliance.missingRequired.length} href="/photos/compliance" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Thumbnail maintenance is backup-gated. Run <code className="rounded bg-white px-1 font-semibold text-slate-900">npm run photos:backfill-thumbnails:dry-run</code> first, then run <code className="rounded bg-white px-1 font-semibold text-slate-900">npm run backup</code> before any confirmed apply.
        </div>
        {review.photoCompliance.missingRequired.length ? (
          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-950">Show assets needing photos</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {review.photoCompliance.missingRequired.slice(0, 40).map((asset) => <MissingPhotoCard key={asset.id} asset={asset} />)}
            </div>
          </details>
        ) : (
          <EmptyState title="Required photo checklist is complete" description="Every asset has the currently recommended photo types." />
        )}
      </ReviewSection>

      <ReviewSection title="Skipped Duplicate Workbook Rows" description="Rows skipped because they duplicated a tag or serial already seen earlier in the workbook." action={<ExportLink type="skipped-duplicates" label="Export skipped CSV" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={ShieldCheck} label="Skipped Rows" value={review.skippedDuplicates.length} helper="Not imported automatically" />
          <SummaryCard icon={Database} label="Import Status" value={review.importAudit?.status ?? "None"} helper={review.importAudit?.id ?? "No ImportRun"} />
          <SummaryCard icon={AlertTriangle} label="Warnings" value={review.importAudit?.warningCount ?? 0} helper="Import audit warning rows" />
          <SummaryCard icon={ShieldCheck} label="Redactions" value={review.importAudit?.redactionCount ?? 0} helper="Credential-looking notes redacted" />
        </div>
        <details className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-950">Show skipped duplicate rows</summary>
          <div className="mt-3 grid gap-2">
            {review.skippedDuplicates.slice(0, 40).map((row) => (
              <div key={`${row.sheetName}-${row.rowNumber}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{row.sheetName} row {row.rowNumber}</p>
                    <p className="text-slate-600">{row.duplicateType}: {row.duplicateKey || "see raw audit row"}</p>
                    <p className="text-xs text-slate-500">Kept row: {row.firstSeenAt || "not listed"}</p>
                  </div>
                  <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Review skipped duplicate ${row.sheetName} row ${row.rowNumber}`)}&category=INVENTORY`}>Create Task</ActionLink>
                </div>
              </div>
            ))}
          </div>
        </details>
      </ReviewSection>

      <ReviewSection title="Unlinked Facturas" description="Purchase records with no linked assets or stock. These are review items only." action={<ExportLink type="unlinked-facturas" />}>
        {review.unlinkedFacturas.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {review.unlinkedFacturas.slice(0, 20).map((factura) => (
              <MobileCard key={factura.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Factura</p>
                    <h3 className="text-lg font-semibold text-slate-950">{factura.facturaNumber}</h3>
                    <p className="mt-1 text-sm text-slate-600">{factura.vendorName}</p>
                    {factura.notes ? <p className="mt-2 line-clamp-2 text-sm text-slate-500">{factura.notes}</p> : null}
                  </div>
                  <Badge className="w-fit bg-amber-50 text-amber-800 ring-amber-200">Unlinked</Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:flex">
                  <ActionLink href={`/facturas/${factura.id}`}>Open</ActionLink>
                  <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Link factura ${factura.facturaNumber}`)}&category=PURCHASE&relatedFacturaId=${factura.id}`}>Create Task</ActionLink>
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="All facturas are linked" description="Every factura has at least one linked asset or stock item." />
        )}
      </ReviewSection>

      <ReviewSection title="Missing Critical Fields" description="Review lists for asset tags, serial numbers, models, and location/area." action={<ExportLink type="missing-asset-tags" label="Export missing tags" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MissingFieldCard title="Missing asset tag" count={review.missing.missingAssetTag.length} assets={review.missing.missingAssetTag} exportType="missing-asset-tags" />
          <MissingFieldCard title="Missing serial" count={review.missing.missingSerial.length} assets={review.missing.missingSerial} exportType="missing-serials" />
          <MissingFieldCard title="Missing model" count={review.missing.missingModel.length} assets={review.missing.missingModel} />
          <MissingFieldCard title="Missing location/area" count={review.missing.missingLocation.length} assets={review.missing.missingLocation} />
        </div>
      </ReviewSection>

      <ReviewSection title="Static / Network Assets" description="Printers, scales, desktops, cameras, NVRs, switches, and APs that may need location/IP review." action={<ExportLink type="static-missing-ip-mac" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Network} label="Static Candidates" value={review.staticNetwork.total} helper={`${review.staticNetwork.withIp} with IP, ${review.staticNetwork.withMac} with MAC`} />
          <SummaryCard icon={Scale} label="Scales" value={review.staticNetwork.scales.total} helper={`${review.staticNetwork.scales.withIp} with IP/static candidates`} />
          <SummaryCard icon={Wrench} label="Printers" value={review.staticNetwork.printers.total} helper={`${review.staticNetwork.printers.withIp} with IP`} />
          <SummaryCard icon={AlertTriangle} label="Missing IP/MAC" value={review.staticNetwork.missingIp.length + review.staticNetwork.missingMac.length} helper="Review only, not auto-fixed" />
          <SummaryCard icon={Truck} label="Missing Placement" value={review.staticNetwork.missingLocation.length} helper="Use Move / Relocate" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <AssetList title="Scales missing IP" assets={review.staticNetwork.scales.missingIp.slice(0, 8)} taskPrefix="Verify scale network data" />
          <AssetList title="Printers missing IP" assets={review.staticNetwork.printers.missingIp.slice(0, 8)} taskPrefix="Verify printer network data" />
          <AssetList title="Static assets missing location" assets={review.staticNetwork.missingLocation.slice(0, 8)} taskPrefix="Move static asset to correct location" />
          <AssetList title="Static IP assets missing location" assets={review.staticNetwork.staticIpMissingLocation.slice(0, 8)} taskPrefix="Verify installed asset placement" />
        </div>
      </ReviewSection>

      <ReviewSection title="Mobile Apple Device Review" description="Phones and tablets should stay inventory-only unless deliberately configured later." action={<ExportLink type="mobile-network-violations" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard icon={Smartphone} label="iPods" value={review.mobile.iPods} helper="Detected from model/name" />
          <SummaryCard icon={Smartphone} label="iPhones" value={review.mobile.iPhones || review.mobile.phones} helper="Phone inventory" />
          <SummaryCard icon={Smartphone} label="iPads" value={review.mobile.iPads} helper="Detected from model/name" />
          <SummaryCard icon={ShieldCheck} label="Tracking Enabled" value={review.mobile.networkTrackingEnabled} helper="Expected 0" tone={review.mobile.networkTrackingEnabled ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"} />
          <SummaryCard icon={Network} label="Mobile IPs" value={review.mobile.withIp} helper="Expected 0" tone={review.mobile.withIp ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"} />
        </div>
      </ReviewSection>

      <ReviewSection title="Suspicious Assignments / Asset-Like Assigned Values" description="Legacy mobile/sled labels that were imported into Assigned To. These are review items unless the cleanup script is run after backup and dry-run review." action={<ExportLink type="suspicious-assignments" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Smartphone} label="Suspicious assigned values" value={review.suspiciousAssignments.length} helper="Looks like TFG/GHT/placeholders" />
          <SummaryCard icon={ShieldCheck} label="Safe clear candidates" value={review.mobilePairingReview.assignmentsToClear.length} helper="No linked employee/current assignment" />
          <SummaryCard icon={Network} label="Pairings detected" value={review.mobilePairingReview.pairingsToCreate.length} helper="Exact mobile/sled matches" />
          <SummaryCard icon={AlertTriangle} label="Needs manual review" value={review.mobilePairingReview.ambiguousPairings.length} helper="No confident asset match" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ExportLink type="mobile-pairing-review" label="Export pairing CSV" />
          <ExportLink type="device-aliases" label="Export alias CSV" />
        </div>
        {review.suspiciousAssignments.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {review.suspiciousAssignments.slice(0, 30).map((item) => <SuspiciousAssignmentCard key={`${item.device.id}-${item.assignedValue}`} item={item} />)}
          </div>
        ) : (
          <EmptyState title="No asset-like assignments" description="Assigned values look like real people or departments." />
        )}
      </ReviewSection>

      <ReviewSection
        title="Physical Label / Sled Review"
        description="Review physical scan-label collisions and sled records that still use a generic database category. This section does not auto-change records."
        action={
          <PageActions>
            <ExportLink type="label-alias-review" label="Export label CSV" />
            <ExportLink type="sled-category-review" label="Export sled CSV" />
          </PageActions>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Tags} label="Duplicate label codes" value={review.labelAliasReview.length} helper="Same physical code on multiple assets" />
          <SummaryCard icon={Smartphone} label="Sled display review" value={review.sledCategoryReview.length} helper="Sleds stored as generic Other" />
          <SummaryCard icon={ShieldCheck} label="Alias apply mode" value="Manual" helper="Codes apply only from /labels" />
          <SummaryCard icon={Download} label="CSV" value="Ready" helper="Export review lists" />
        </div>
        {review.labelAliasReview.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {review.labelAliasReview.slice(0, 16).map((group) => (
              <MobileCard key={group.normalizedValue} className="border-amber-200 bg-amber-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Duplicate physical label</p>
                    <h3 className="text-lg font-semibold text-slate-950">{group.normalizedValue}</h3>
                    <p className="mt-1 text-sm text-slate-600">{group.count} alias rows share this code.</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-900 ring-amber-200">Review</Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {group.aliases.map((item) => (
                    <AssetMiniCard key={`${group.normalizedValue}-${item.device.id}-${item.aliasType}`} asset={item.device} />
                  ))}
                </div>
              </MobileCard>
            ))}
          </div>
        ) : (
          <EmptyState title="No duplicate physical label aliases" description="No SCAN_CODE or PHYSICAL_LABEL alias is currently shared by multiple assets." />
        )}
        {review.sledCategoryReview.length ? (
          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-950">Show sled display review</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {review.sledCategoryReview.slice(0, 30).map((asset) => <SledReviewCard key={asset.id} asset={asset} />)}
            </div>
          </details>
        ) : null}
      </ReviewSection>

      <ReviewSection
        title="Stock Cleanup Review"
        description="Review quantity stock that is uncategorized, inactive, zero on hand, or missing usage history. Category actions only change category."
        action={<ExportLink type="stock-cleanup-review" />}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Package} label="Stock Items" value={review.stock.total} helper="Total stock records" />
          <SummaryCard icon={AlertTriangle} label="Quantity 0" value={review.stock.quantityZero.length} helper="May need review" />
          <SummaryCard icon={AlertTriangle} label="Needs category" value={review.stock.categorySuggestions.length} helper="Safe category suggestions" />
          <SummaryCard icon={Package} label="Other category" value={review.stock.categoryOther.length} helper="Worth reviewing after import" />
          <SummaryCard icon={AlertTriangle} label="Below Minimum" value={review.stock.belowMinimum.length} helper="At or below threshold" />
          <SummaryCard icon={ReceiptText} label="Linked to Factura" value={review.stock.linkedToFacturas.length} helper={`${review.stock.notLinkedToFacturas.length} not linked`} />
          <SummaryCard icon={Package} label="Missing SKU" value={review.stock.missingSku.length} helper="May be OK for generic stock" />
          <SummaryCard icon={ShieldCheck} label="No movement history" value={review.stock.noMovementHistory.length} helper="Imported or unused stock" />
        </div>
        {review.stock.categorySuggestions.length ? (
          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-950">Show suggested category cleanup</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {review.stock.categorySuggestions.slice(0, 30).map((item) => <StockCategorySuggestionCard key={item.id} item={item} />)}
            </div>
          </details>
        ) : (
          <EmptyState title="No stock category suggestions" description="Current active stock categories look consistent with the classifier." />
        )}
      </ReviewSection>

      <ReviewSection
        title="Stock vs Asset Classification Review"
        description="Review records that may belong to the other workflow. This is review-only: no stock/device conversion happens automatically."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard icon={Package} label="Peripheral-like Devices" value={review.stockVsAssetClassification.genericPeripheralDevices.length} helper="May belong in stock/peripherals" />
          <SummaryCard icon={AlertTriangle} label="Serialized-looking Stock" value={review.stockVsAssetClassification.serializedLookingStock.length} helper="Confirm quantity stock vs asset" />
          <SummaryCard icon={Package} label="Stock Type Review" value={review.stockVsAssetClassification.stockMissingUsefulType.length} helper="Other category or missing type" />
        </div>
        {review.stockVsAssetClassification.genericPeripheralDevices.length || review.stockVsAssetClassification.serializedLookingStock.length ? (
          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="min-h-11 cursor-pointer list-none font-semibold text-slate-950">Show classification review items</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {review.stockVsAssetClassification.genericPeripheralDevices.slice(0, 20).map((asset) => (
                <MobileCard key={`device-${asset.id}`}>
                  <p className="text-sm font-semibold text-slate-500">Peripheral-like Device</p>
                  <AssetMiniCard asset={asset} />
                  <p className="mt-2 text-sm text-slate-600">{asset.reason}</p>
                </MobileCard>
              ))}
              {review.stockVsAssetClassification.serializedLookingStock.slice(0, 20).map((item) => (
                <MobileCard key={`stock-${item.id}`}>
                  <p className="text-sm font-semibold text-slate-500">Serialized-looking Stock</p>
                  <h3 className="text-lg font-semibold text-slate-950">{item.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{stockCategoryLabels[item.category as keyof typeof stockCategoryLabels] ?? item.category} / {item.quantityOnHand} on hand</p>
                  <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                  <div className="mt-4 grid gap-2 sm:flex">
                    <ActionLink href={`/stock/${item.id}`}>Open stock</ActionLink>
                    <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Review stock classification: ${item.name}`)}&category=STOCK&relatedStockItemId=${item.id}`}>Create Task</ActionLink>
                  </div>
                </MobileCard>
              ))}
            </div>
          </details>
        ) : (
          <EmptyState title="No stock/asset classification issues" description="No obvious generic peripherals stored as devices or serialized-looking stock items were detected." />
        )}
      </ReviewSection>

      <ReviewSection title="Import Audit" description="Latest ImportRun and local audit files saved during the first controlled import.">
        {review.importAudit ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <MobileCard>
              <p className="text-sm font-semibold text-slate-500">Latest ImportRun</p>
              <h3 className="mt-1 break-all text-lg font-semibold text-slate-950">{review.importAudit.id}</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>Status: <span className="font-semibold text-slate-950">{review.importAudit.status}</span></p>
                <p>File: {review.importAudit.fileName}</p>
                <p>Warnings: {review.importAudit.warningCount}</p>
                <p>Duplicates skipped: {review.importAudit.duplicateCount}</p>
                <p>Redactions: {review.importAudit.redactionCount}</p>
              </div>
            </MobileCard>
            <MobileCard>
              <p className="text-sm font-semibold text-slate-500">Audit files</p>
              <p className="mt-1 break-all text-sm text-slate-600">{review.importAudit.backupRoot ?? "No backup folder found"}</p>
              <div className="mt-3 grid gap-2">
                {review.importAudit.auditFiles.map((file) => (
                  <div key={file.fileName} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-950">{file.fileName}</p>
                    <p className="break-all text-xs text-slate-500">{file.path}</p>
                  </div>
                ))}
              </div>
            </MobileCard>
          </div>
        ) : (
          <EmptyState title="No ImportRun found" description="Run a legacy import to populate audit details." />
        )}
      </ReviewSection>
    </div>
  );
}

function ReviewSection({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SectionCard className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </SectionCard>
  );
}

function SummaryCard({ icon: Icon, label, value, helper, tone = "border-slate-200 bg-white", href }: { icon: React.ElementType; label: string; value: React.ReactNode; helper: string; tone?: string; href?: string }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
        <Icon className="shrink-0 text-slate-400" size={20} />
      </div>
      <p className="mt-4 text-3xl font-semibold text-slate-950">{value}</p>
    </>
  );
  if (href) return <Link href={href} className={`block rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}>{content}</Link>;
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      {content}
    </div>
  );
}

function AssetMiniCard({ asset }: { asset: Asset }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">{asset.name}</p>
          <p className="text-sm text-slate-500">{asset.assetTag || "No tag"} / {asset.serialNumber || "No serial"}</p>
          <p className="text-sm text-slate-500">{categoryLabels[asset.category as keyof typeof categoryLabels] ?? asset.category} / {statusLabels[asset.status as keyof typeof statusLabels] ?? asset.status}</p>
          <p className="text-sm text-slate-500">{asset.location || asset.areaDepartment || "No location"}</p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Link href={`/devices/${asset.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Open</Link>
          {isMoveUsefulAsset(asset) ? <Link href={`/devices/${asset.id}/move`} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800"><Truck size={15} />Move</Link> : null}
          {isInstallEligibleAsset(asset) ? <Link href={`/devices/${asset.id}/install`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800">Install</Link> : null}
        </div>
      </div>
    </div>
  );
}

function SuspiciousStockCard({ item }: { item: SuspiciousStock }) {
  return (
    <MobileCard className={item.canArchive ? "border-amber-200 bg-amber-50" : ""}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Suspicious stock</p>
          <h3 className="text-lg font-semibold text-slate-950">{item.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{stockCategoryLabels[item.category as keyof typeof stockCategoryLabels] ?? item.category} / {item.quantityOnHand} on hand</p>
          <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
          <p className="mt-2 text-xs text-slate-500">
            {[item.sku ? `SKU ${item.sku}` : "No SKU", item.vendorName ? `Vendor ${item.vendorName}` : "No vendor", item.storageLocation ? `Location ${item.storageLocation}` : "No storage"].join(" / ")}
          </p>
          {item.source ? <p className="mt-1 text-xs text-slate-500">Source: {item.source.sheetName} row {item.source.rowNumber}</p> : null}
        </div>
        <Badge className={item.canArchive ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>{item.canArchive ? "Archive allowed" : "Review only"}</Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:flex">
        <ActionLink href={`/stock/${item.id}`}>Open stock</ActionLink>
        <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Review suspicious stock row: ${item.name}`)}&category=STOCK&relatedStockItemId=${item.id}`}>Create Task</ActionLink>
        {item.canArchive ? (
          <DataQualityActionButton
            endpoint={`/api/data-quality/stock/${item.id}/archive`}
            label="Archive"
            confirmText={`Archive ${item.name}? It will be hidden from normal stock lists and kept in history.`}
            successText="Stock item archived."
            variant="archive"
          />
        ) : null}
      </div>
    </MobileCard>
  );
}

function StockCategorySuggestionCard({ item }: { item: StockCategorySuggestion }) {
  return (
    <MobileCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Suggested category</p>
          <h3 className="text-lg font-semibold text-slate-950">{item.name}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {stockCategoryLabels[item.category as keyof typeof stockCategoryLabels] ?? item.category} to {stockCategoryLabels[item.suggestedCategory as keyof typeof stockCategoryLabels] ?? item.suggestedCategory}
          </p>
          <p className="mt-2 text-sm text-slate-600">{item.suggestionReason}</p>
          <p className="mt-2 text-xs text-slate-500">
            {[item.sku ? `SKU ${item.sku}` : "No SKU", `${item.quantityOnHand} on hand`, item.storageLocation ? `Location ${item.storageLocation}` : "No storage"].join(" / ")}
          </p>
        </div>
        <Badge className="bg-sky-100 text-sky-800 ring-sky-200">Category only</Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:flex">
        <ActionLink href={`/stock/${item.id}`}>Open stock</ActionLink>
        <DataQualityActionButton
          endpoint={`/api/data-quality/stock/${item.id}/apply-suggested-category`}
          label="Apply category"
          confirmText={`Change ${item.name} category to ${stockCategoryLabels[item.suggestedCategory as keyof typeof stockCategoryLabels] ?? item.suggestedCategory}? Quantity and history will not change.`}
          successText="Stock category updated."
        />
      </div>
    </MobileCard>
  );
}

function SuspiciousAssetNameCard({ asset }: { asset: SuspiciousAsset }) {
  return (
    <MobileCard className="border-amber-200 bg-amber-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Suspicious asset name</p>
          <h3 className="text-lg font-semibold text-slate-950">{asset.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{asset.assetTag || "No tag"} / {asset.brand || "No brand"} {asset.model || "No model"}</p>
          <p className="mt-2 text-sm text-slate-600">{asset.reason}</p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">Suggested: {asset.suggestedName}</p>
          {asset.employee ? <p className="mt-1 text-xs text-slate-500">Assigned: {asset.employee.fullName}</p> : null}
          {asset.source ? <p className="mt-1 text-xs text-slate-500">Source: {asset.source.sheetName} row {asset.source.rowNumber}</p> : null}
        </div>
        <Badge className="bg-amber-100 text-amber-900 ring-amber-200">{asset.category}</Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:flex">
        <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
        <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Fix asset display name: ${asset.assetTag || asset.name}`)}&category=INVENTORY&relatedDeviceId=${asset.id}`}>Create Task</ActionLink>
        <DataQualityActionButton
          endpoint={`/api/data-quality/devices/${asset.id}/apply-suggested-name`}
          label="Apply suggested name"
          confirmText={`Rename ${asset.name} to ${asset.suggestedName}? Only the display name will change.`}
          successText="Asset name updated."
        />
      </div>
    </MobileCard>
  );
}

function SuspiciousAssignmentCard({ item }: { item: SuspiciousAssignment }) {
  return (
    <MobileCard className="border-amber-200 bg-amber-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Asset-like assigned value</p>
          <h3 className="text-lg font-semibold text-slate-950">{item.device.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{item.device.assetTag || "No tag"} / {categoryLabels[item.device.category as keyof typeof categoryLabels] ?? item.device.category}</p>
          <p className="mt-2 break-words text-sm text-slate-700">Assigned value: <span className="font-semibold">{item.assignedValue}</span></p>
          <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
          {item.possibleLinkedAsset ? (
            <p className="mt-2 text-sm font-semibold text-emerald-900">Possible pair: {item.possibleLinkedAsset.assetTag || item.possibleLinkedAsset.name}</p>
          ) : null}
        </div>
        <Badge className={item.suggestedRelationship ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-900 ring-amber-200"}>
          {item.suggestedRelationship ? "Pair found" : "Review"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:flex">
        <ActionLink href={`/devices/${item.device.id}`}>Open asset</ActionLink>
        {item.possibleLinkedAsset ? <ActionLink href={`/devices/${item.possibleLinkedAsset.id}`}>Open pair</ActionLink> : null}
        <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Review mobile assignment ${item.device.assetTag || item.device.name}`)}&category=INVENTORY&relatedDeviceId=${item.device.id}`}>Create Task</ActionLink>
      </div>
    </MobileCard>
  );
}

function SledReviewCard({ asset }: { asset: SledReviewAsset }) {
  return (
    <MobileCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Sled review</p>
          <h3 className="text-lg font-semibold text-slate-950">{asset.suggestedDisplayName}</h3>
          <p className="mt-1 text-sm text-slate-600">{asset.assetTag || "No tag"} / {asset.serialNumber || "No serial"}</p>
          <p className="mt-2 text-sm text-slate-600">{asset.reason}</p>
          {asset.source ? <p className="mt-1 text-xs text-slate-500">Source: {asset.source.sheetName} row {asset.source.rowNumber}</p> : null}
        </div>
        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{asset.suggestedCategoryLabel}</Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:flex">
        <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
        <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Review sled category ${asset.assetTag || asset.name}`)}&category=INVENTORY&relatedDeviceId=${asset.id}`}>Create Task</ActionLink>
      </div>
    </MobileCard>
  );
}

function MissingPhotoCard({ asset }: { asset: PhotoReviewAsset }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">{asset.name}</p>
          <p className="text-sm text-slate-500">{asset.assetTag || "No tag"} / {categoryLabels[asset.category as keyof typeof categoryLabels] ?? asset.category}</p>
          <p className="mt-2 text-sm text-slate-600">Missing: {asset.checklist.missing.map((type) => requiredPhotoLabels[type]).join(", ")}</p>
          {asset.employee ? <p className="mt-1 text-xs text-slate-500">Assigned: {asset.employee.fullName}</p> : null}
        </div>
        <Badge className="bg-rose-100 text-rose-800 ring-rose-200">{asset.checklist.missing.length} missing</Badge>
      </div>
      <div className="mt-3 grid gap-2 sm:flex">
        <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
        <ActionLink href={`/devices/${asset.id}#photos`}>Add photo</ActionLink>
      </div>
    </div>
  );
}

function MissingFieldCard({ title, count, assets, exportType }: { title: string; count: number; assets: Asset[]; exportType?: string }) {
  return (
    <MobileCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{count} assets</p>
        </div>
        {exportType ? <ExportLink type={exportType} label="CSV" /> : null}
      </div>
      <div className="mt-3 space-y-2">
        {assets.slice(0, 4).map((asset) => <AssetMiniCard key={asset.id} asset={asset} />)}
        {count > 4 ? <p className="text-sm text-slate-500">Showing 4 of {count}. Use CSV/export for the full list.</p> : null}
      </div>
    </MobileCard>
  );
}

function AssetList({ title, assets, taskPrefix }: { title: string; assets: Asset[]; taskPrefix: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <div className="mt-3 grid gap-2">
        {assets.length ? assets.map((asset) => (
          <div key={asset.id} className="rounded-md border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-950">{asset.name}</p>
            <p className="text-sm text-slate-500">{asset.model || "No model"} / {asset.serialNumber || "No serial"}</p>
            <div className="mt-3 grid gap-2 sm:flex">
              <ActionLink href={`/devices/${asset.id}`}>Open</ActionLink>
              <ActionLink href={`/tasks/new?title=${encodeURIComponent(`${taskPrefix}: ${asset.name}`)}&category=MAINTENANCE&relatedDeviceId=${asset.id}`}>Create Task</ActionLink>
            </div>
          </div>
        )) : <EmptyState title="Nothing to review here" />}
      </div>
    </div>
  );
}

function SignalCard({ title, value, href }: { title: string; value: number; href?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
      {href ? <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 hover:text-slate-950" href={href}>Export CSV</Link> : null}
    </div>
  );
}

function ExportLink({ type, label = "Export CSV" }: { type: string; label?: string }) {
  return (
    <Link href={`/api/data-quality/export/${type}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
      <Download size={15} />
      {label}
    </Link>
  );
}
