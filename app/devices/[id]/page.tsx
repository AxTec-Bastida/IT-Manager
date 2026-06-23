import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveX, CircleDollarSign, ClipboardList, Download, Edit, MapPin, Network, PackageCheck, Printer, RotateCcw, Route, ScanLine, ShieldCheck, Tags, Truck, UserRoundPlus, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { AssetPhotoPanel } from "@/components/asset-photo-panel";
import { CopyButton } from "@/components/copy-button";
import { LabelPreviewCard } from "@/components/label-preview";
import { assetLoanItemReturnStatusLabels, assetLoanItemReturnStatusTone, assetLoanStatusLabels, assetLoanStatusTone, maintenanceTypeLabels, rmaCaseStatusLabels, rmaCaseStatusTone, rmaItemResultLabels, rmaItemResultTone, severityTone, statusLabels, statusTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";
import { isAssetLikeAssignedValue } from "@/lib/mobile-legacy";
import { labelItemForAsset, physicalLabelCodeForAsset } from "@/lib/label-aliases";
import { getAssetCategoryLabel, getAssetDisplayName, isSledAsset } from "@/lib/asset-display";
import { ChargerStatusPanel } from "@/components/charger-status-panel";
import { installActionLabel, isInstallEligibleAsset } from "@/lib/equipment-install";
import { isMoveUsefulAsset } from "@/lib/equipment-move";
import { assignmentResponsibleLabel } from "@/lib/assignment-views";
import { canPerformAction, getCurrentUser } from "@/lib/auth";
import { canManageBitLockerKey, canRevealBitLockerKey, isBitLockerEligibleCategory } from "@/lib/bitlocker-vault";
import { buildAnchorDisplayPath } from "@/lib/map-anchors";
import { decommissionReasonLabels } from "@/lib/decommission";
import { buildMaintenanceSummary, maintenanceResultLabels, maintenanceStatusLabel } from "@/lib/maintenance";
import { buildAssetValueSummary, canEditAssetValue, canViewAssetValue, formatAssetAge, formatMoney } from "@/lib/depreciation";
import { lineItemValueSourceLabel } from "@/lib/factura-line-items";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ returned?: string; installed?: string; moved?: string; decommissioned?: string; value?: string }> };

export default async function DeviceDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const [device, allDevices, activity, currentUser] = await Promise.all([
    prisma.device.findUnique({
      where: { id },
      include: {
        ipRange: true,
        employee: true,
        factura: true,
        expectedLocationZone: true,
        currentMapAnchor: { include: { map: true } },
        photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
        maintenanceRecords: { include: { stockItem: true }, orderBy: { performedAt: "desc" }, take: 10 },
        assignmentItems: { include: { assignment: { include: { employee: true } } }, orderBy: { createdAt: "desc" } },
        rmaItems: { include: { rmaCase: true, replacementDevice: true }, orderBy: { createdAt: "desc" } },
        assetLoanItems: { include: { loan: { include: { employee: true, temporaryBorrower: true } } }, orderBy: { createdAt: "desc" } },
        aliases: { orderBy: [{ aliasType: "asc" }, { value: "asc" }] },
        sourceRelationships: { include: { targetDevice: true }, orderBy: { createdAt: "desc" } },
        targetRelationships: { include: { sourceDevice: true }, orderBy: { createdAt: "desc" } },
        decommissionRecords: { orderBy: { performedAt: "desc" } },
        bitLockerRecoveryKey: true,
        valueProfile: {
          include: {
            sourceFacturaLineItemAsset: {
              include: {
                lineItem: { include: { factura: true } },
              },
            },
          },
        },
      },
    }),
    prisma.device.findMany({ include: { ipRange: true } }),
    prisma.activityLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    getCurrentUser(),
  ]);

  if (!device) notFound();

  const [deviceScanResults, locationHistory] = await Promise.all([
    device.ipAddress ? prisma.scanResult.findMany({ where: { ipAddress: device.ipAddress }, orderBy: { seenAt: "desc" }, take: 10 }) : Promise.resolve([]),
    prisma.assetLocationHistory.findMany({ where: { assetId: device.id }, orderBy: { seenAt: "desc" }, take: 5 }),
  ]);
  const conflicts = detectInventoryConflicts(allDevices).filter((conflict) => conflict.affectedDeviceIds?.includes(id));
  const lastKnownLocation = locationHistory[0];
  const isPrinter = ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"].includes(device.category);
  const isScale = device.category === "SCALE";
  const supportsMaintenance = isPrinter || isScale;
  const isMobileAppleLike = ["PHONE", "TABLET"].includes(device.category);
  const showNetworkTracking = !isMobileAppleLike && Boolean(device.ipAddress || device.macAddress || device.usesStaticIp || device.movementAlertsEnabled);
  const latestMaintenance = device.maintenanceRecords[0];
  const maintenanceSummary = buildMaintenanceSummary(device);
  const activeAssignmentItem = device.assignmentItems.find((item) => !item.returnedAt && ["ACTIVE", "PARTIALLY_RETURNED"].includes(item.assignment.status));
  const activeRmaItem = device.rmaItems.find((item) => item.result === "PENDING" && ["SENT", "ACTIVE", "PARTIALLY_RETURNED"].includes(item.rmaCase.status));
  const activeLoanItem = device.assetLoanItems.find((item) => item.returnStatus === "PENDING" && ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"].includes(item.loan.status));
  const legacyAssignedValue = device.assignedTo && isAssetLikeAssignedValue(device.assignedTo) ? device.assignedTo : null;
  const physicalLabelCode = physicalLabelCodeForAsset(device);
  const labelItem = labelItemForAsset(device, { usePhysicalLabel: Boolean(physicalLabelCode) });
  const displayName = getAssetDisplayName(device);
  const displayCategory = getAssetCategoryLabel(device);
  const installEligible = isInstallEligibleAsset(device);
  const moveUseful = isMoveUsefulAsset(device);
  const canWriteInventory = canPerformAction(currentUser, "inventory.write");
  const showAssetValue = canViewAssetValue(currentUser);
  const editAssetValue = canEditAssetValue(currentUser);
  const canWriteTasks = canPerformAction(currentUser, "tasks.write");
  const canWriteAssignments = canPerformAction(currentUser, "assignments.write");
  const canWriteLoans = canPerformAction(currentUser, "loans.write");
  const canWriteRma = canPerformAction(currentUser, "rma.write");
  const lastMoveActivity = activity.find((item) => item.action === "device.moved");
  const currentEmployee = activeAssignmentItem?.assignment.employee ?? device.employee;
  const activeResponsibility = activeAssignmentItem ? assignmentResponsibleLabel(activeAssignmentItem.assignment) : null;
  const displayAssignedTo = activeResponsibility || currentEmployee?.fullName || (legacyAssignedValue ? null : device.assignedTo);
  const isCurrentlyAssigned = Boolean(currentEmployee || displayAssignedTo || activeAssignmentItem || device.status === "IN_USE_ASSIGNED");
  const pairedRelationships = [
    ...device.sourceRelationships
      .filter((r) => ["PAIRED_WITH", "IPOD_SLED_PAIR", "IPHONE_SLED_PAIR"].includes(r.relationshipType))
      .map((r) => ({ relationship: r, paired: r.targetDevice })),
    ...device.targetRelationships
      .filter((r) => ["PAIRED_WITH", "IPOD_SLED_PAIR", "IPHONE_SLED_PAIR"].includes(r.relationshipType))
      .map((r) => ({ relationship: r, paired: r.sourceDevice })),
  ];
  const currentAnchorPath = device.currentMapAnchor ? buildAnchorDisplayPath(device.currentMapAnchor) : null;
  const latestDecommissionRecord = device.decommissionRecords[0];
  const valueSummary = buildAssetValueSummary(device);
  const valueCurrency = device.valueProfile?.currency ?? "MXN";
  const valueSource = lineItemValueSourceLabel(device.valueProfile ?? undefined);
  const bitLockerEligible = isBitLockerEligibleCategory(device.category);
  const canManageBitLocker = canManageBitLockerKey(currentUser);
  const canRevealBitLocker = canRevealBitLockerKey(currentUser);
  const offlineMoveParams = new URLSearchParams({ deviceId: device.id });
  if (device.assetTag) offlineMoveParams.set("assetTag", device.assetTag);
  const offlineMoveHref = `/offline/move?${offlineMoveParams.toString()}`;

  const fields = [
    ["Asset tag", device.assetTag || "-"],
    ["Category", displayCategory],
    ["Condition", device.condition.replaceAll("_", " ")],
    ["IP address", device.ipAddress || "-"],
    ["MAC address", device.macAddress || "-"],
    ["VLAN", device.vlan ?? "-"],
    ["Range/pool", device.ipRange?.name || "No assigned range"],
    ["Location", device.location || "-"],
    ["Area / department", device.areaDepartment || "-"],
    ["Brand", device.brand || "-"],
    ["Model", device.model || "-"],
    ["Serial number", device.serialNumber || "-"],
    ["Responsibility target", displayAssignedTo || "-"],
    ["Fixed/static movement", device.movementAlertsEnabled ? `Enabled - expected ${device.expectedLocationZone?.name || "zone not set"}` : "Disabled"],
    ["Factura", device.factura ? `${device.factura.facturaNumber} - ${device.factura.vendorName}` : "-"],
    ["Purchase date", device.purchaseDate ? device.purchaseDate.toLocaleDateString() : "-"],
    ["Warranty expires", device.warrantyExpiresAt ? device.warrantyExpiresAt.toLocaleDateString() : "-"],
    ["Last seen", device.lastSeenAt ? device.lastSeenAt.toLocaleString() : "Never"],
    ["Created", device.createdAt.toLocaleString()],
    ["Updated", device.updatedAt.toLocaleString()],
  ];

  return (
    <div className="space-y-6 pb-36 lg:pb-0">
      <PageHeader
        title={displayName}
        description={`${device.ipAddress || "No IP"}${device.vlan ? ` on VLAN ${device.vlan}` : ""}`}
        action={
          <div className="grid gap-2 sm:flex">
            {canWriteInventory ? <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              <Edit size={16} />
              Edit
            </Link> : null}
            {canWriteInventory && installEligible ? (
              <Link href={`/devices/${device.id}/install`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
                <Network size={16} />
                {installActionLabel(device)}
              </Link>
            ) : null}
            {canWriteInventory && moveUseful ? (
              <Link href={`/devices/${device.id}/move`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800">
                <Truck size={16} />
                Move / Relocate
              </Link>
            ) : null}
            {canWriteInventory && moveUseful ? (
              <Link href={offlineMoveHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100">
                <Route size={16} />
                Offline move
              </Link>
            ) : null}
            <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ScanLine size={16} />
              Scan
            </Link>
            <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <MapPin size={16} />
              Map
            </Link>
            {canWriteInventory ? <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Wrench size={16} />
              Add maintenance
            </Link> : null}
            {canWriteTasks ? <Link href={`/tasks/new?relatedDeviceId=${device.id}&category=INVENTORY&title=${encodeURIComponent(`Follow up ${device.name}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ClipboardList size={16} />
              Create Task
            </Link> : null}
            {activeRmaItem ? (
              <Link href={`/rma/${activeRmaItem.rmaCaseId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800">
                <PackageCheck size={16} />
                Open RMA
              </Link>
            ) : canWriteRma ? (
              <Link href={`/rma/new?deviceId=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <PackageCheck size={16} />
                Create RMA
              </Link>
            ) : null}
            {activeLoanItem ? (
              <Link href={`/loans/${activeLoanItem.loanId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                <ClipboardList size={16} />
                Open Loan
              </Link>
            ) : canWriteLoans ? (
              <Link href={`/loans/quick-checkout?assetId=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ClipboardList size={16} />
                Quick Loan
              </Link>
            ) : null}
            {canWriteAssignments && isCurrentlyAssigned ? (
              <Link href={`/devices/${device.id}/return`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                <RotateCcw size={16} />
                Return / Unassign
              </Link>
            ) : null}
            {canWriteInventory ? (
              <Link href={`/devices/${device.id}/decommission`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                <ArchiveX size={16} />
                Decommission
              </Link>
            ) : null}
          </div>
        }
      />

      {query.returned ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Asset returned and unassigned. Assignment history was preserved.
        </div>
      ) : null}

      {query.installed ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Installation details saved. Asset history, photos, facturas, assignments, RMA, and loans were preserved.
        </div>
      ) : null}

      {query.moved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Location updated. Assignment, loan, RMA, photos, facturas, and network values were preserved.
        </div>
      ) : null}

      {query.decommissioned ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Asset decommissioned. History, photos, facturas, labels, aliases, assignments, loans, RMA, audits, and activity were preserved.
        </div>
      ) : null}

      {query.value ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Internal asset value estimate saved.
        </div>
      ) : null}

      <section className="grid items-start gap-4 xl:grid-cols-3">
        <div className="self-start xl:col-span-2 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusTone[device.status]}>{statusLabels[device.status]}</Badge>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{displayCategory}</Badge>
            {conflicts.length ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Conflict flagged</Badge> : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Asset tag", device.assetTag || "-"],
              ["Location", device.location || "-"],
              ["Assigned", displayAssignedTo || "Unassigned"],
              ["IP", device.ipAddress || "No IP"],
              ["Serial", device.serialNumber || "-"],
              ["Last seen", lastKnownLocation?.locationLabel || device.lastSeenAt?.toLocaleString() || "No location updates yet"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <details className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950">
              All asset details
              <span className="text-xs text-slate-500">Expand</span>
            </summary>
            <dl className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <div key={label} className="rounded-md bg-white p-3">
                  <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words text-sm text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
          {device.notes ? (
            <div className="mt-4 rounded-md bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-700">{device.notes}</p>
            </div>
          ) : null}
          {device.repairNotes ? (
            <div className="mt-4 rounded-md bg-amber-50 p-3">
              <p className="text-xs font-medium uppercase text-amber-700">RMA / repair notes</p>
              <p className="mt-1 text-sm text-amber-900">{device.repairNotes}</p>
            </div>
          ) : null}
          {latestDecommissionRecord ? (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-medium uppercase text-rose-700">Decommission record</p>
              <p className="mt-1 text-sm font-semibold text-rose-950">
                {decommissionReasonLabels[latestDecommissionRecord.reason]} / final status {statusLabels[latestDecommissionRecord.finalStatus]}
              </p>
              <p className="mt-1 text-sm text-rose-900">
                {latestDecommissionRecord.performedAt.toLocaleString()} by {latestDecommissionRecord.performedByName || "unknown"}
              </p>
              {latestDecommissionRecord.notes ? <p className="mt-2 text-sm text-rose-900">{latestDecommissionRecord.notes}</p> : null}
            </div>
          ) : null}
          </div>

          {/* Charger Status widget for Laptops */}
          {device.category === "LAPTOP" && (
            <ChargerStatusPanel
              deviceId={device.id}
              currentStatus={device.chargerStatus}
              currentNotes={device.chargerNotes}
              maintenanceHistory={device.maintenanceRecords}
              canWrite={canWriteInventory}
            />
          )}

          {/* Mobile / Sled pairing widget */}
          {(device.category === "PHONE" || isSledAsset(device)) && (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-950">Mobile / Sled Pairing</h2>
              {pairedRelationships.length ? (
                <div className="mt-3 grid gap-2">
                  {pairedRelationships.map(({ relationship, paired }) => {
                    if (!paired) return null;
                    return (
                      <div key={relationship.id} className="rounded-md bg-slate-50 p-3 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase text-slate-500">
                              {relationship.relationshipType.replaceAll("_", " ")}
                            </p>
                            <p className="mt-1 font-semibold text-slate-950">{paired.name}</p>
                            <p className="text-slate-600">{paired.assetTag || "No tag"} / {paired.serialNumber || "No serial"}</p>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/devices/${paired.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">Open</Link>
                            {canWriteInventory && (
                              <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">Change</Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-950">No Sled or Phone paired</p>
                  <p className="text-slate-500">This {device.category === "PHONE" ? "iPhone/iPod" : "Sled"} is not currently related to any companion device.</p>
                  {canWriteInventory && (
                    <Link href={`/devices/${device.id}/edit`} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                      Pair Companion Device
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Location / Placement */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Location / Placement</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Current location / area</p>
                <p className="mt-1 font-medium text-slate-950">{[device.areaDepartment, device.location].filter(Boolean).join(" / ") || "No inventory location set"}</p>
                {device.expectedLocationZone ? <p className="text-slate-600">Expected zone: {device.expectedLocationZone.name}</p> : null}
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Map anchor</p>
                {device.currentMapAnchor ? (
                  <>
                    <p className="mt-1 font-medium text-slate-950">{currentAnchorPath}</p>
                    <p className="text-slate-600">{device.currentMapAnchor.map?.name ?? "No map assigned"} / {device.currentMapAnchor.x}%, {device.currentMapAnchor.y}%</p>
                  </>
                ) : (
                  <p className="mt-1 font-medium text-slate-950">No map anchor linked</p>
                )}
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Last moved</p>
                <p className="mt-1 font-medium text-slate-950">{lastMoveActivity?.createdAt.toLocaleString() ?? "No manual move recorded yet."}</p>
                {lastMoveActivity ? <p className="text-slate-600">{lastMoveActivity.message}</p> : null}
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Last seen / update</p>
                <p className="mt-1 font-medium text-slate-950">{lastKnownLocation?.seenAt.toLocaleString() ?? device.lastSeenAt?.toLocaleString() ?? "No location updates yet."}</p>
                {lastKnownLocation ? <p className="text-slate-600">{lastKnownLocation.locationLabel}</p> : null}
              </div>
              {lastKnownLocation ? (
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Last location note</p>
                  <p className="mt-1 font-medium text-slate-950">{lastKnownLocation.notes || lastKnownLocation.apName}</p>
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {canWriteInventory && moveUseful ? (
                  <Link href={`/devices/${device.id}/move`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 cursor-pointer">
                    <Truck size={16} />
                    Move / Relocate
                  </Link>
                ) : null}
                {canWriteInventory && installEligible ? (
                  <Link href={`/devices/${device.id}/install`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-cyan-300 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 cursor-pointer">
                    <Network size={16} />
                    {installActionLabel(device)}
                  </Link>
                ) : null}
                {canWriteInventory ? <Link href={`/devices/${device.id}?photoType=LOCATION_INSTALLED#photos`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <MapPin size={16} />
                  Add location photo
                </Link> : null}
                <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer">
                  <MapPin size={16} />
                  View on Map
                </Link>
                <Link href={`/map?asset=${device.id}&history=5`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer lg:col-span-2">
                  <Route size={16} />
                  View Last 5 Locations
                </Link>
              </div>
            </div>
          </section>

          {/* Network / IPAM */}
          {showNetworkTracking ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-950">Network / IPAM</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">IP / MAC</p>
                  <p className="mt-1 font-mono font-medium text-slate-950">{device.ipAddress || "No IP"}</p>
                  <p className="break-all font-mono text-slate-600">{device.macAddress || "No MAC"}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Static tracking</p>
                  <p className="mt-1 font-medium text-slate-950">{device.usesStaticIp ? "Static IP asset" : "Not marked static"}</p>
                  <p className="text-slate-600">{device.movementAlertsEnabled ? "Movement alerts enabled" : "Movement alerts off"}</p>
                </div>
              </div>
            </section>
          ) : null}

          {/* Installation / Network Setup */}
          {installEligible ? (
            <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-4">
              <h2 className="font-semibold text-slate-950">Installation / Network Setup</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-md bg-white p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Install state</p>
                  <p className="mt-1 font-medium text-slate-950">{statusLabels[device.status]} / {device.location || device.areaDepartment || "No location set"}</p>
                </div>
                <div className="rounded-md bg-white p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">IP / MAC / VLAN</p>
                  <p className="mt-1 break-all font-mono font-medium text-slate-950">{device.ipAddress || "No IP"} / {device.macAddress || "No MAC"} / {device.vlan ?? "No VLAN"}</p>
                </div>
                <div className="rounded-md bg-white p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Static flags</p>
                  <p className="mt-1 font-medium text-slate-950">{device.usesStaticIp ? "Static IP" : "No static IP"} / {device.isFixedAsset ? "Fixed asset" : "Not fixed"}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {canWriteInventory ? (
                  <Link href={`/devices/${device.id}/install`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800 cursor-pointer">
                    <Network size={16} />
                    {installActionLabel(device)}
                  </Link>
                ) : null}
                {canWriteInventory ? (
                  <Link href={`/devices/${device.id}?photoType=LOCATION_INSTALLED#photos`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-cyan-300 bg-white px-3 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 cursor-pointer">
                    <MapPin size={16} />
                    Add location photo
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Conflict status */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Conflict status</h2>
            <div className="mt-3 space-y-3">
              {conflicts.map((conflict) => (
                <div key={`${conflict.type}-${conflict.title}`} className="rounded-md bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-950">{conflict.title}</p>
                    <Badge className={severityTone[conflict.severity]}>{conflict.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{conflict.suggestedFix}</p>
                </div>
              ))}
              {conflicts.length === 0 ? <p className="text-sm text-slate-500">No conflicts detected for this device.</p> : null}
            </div>
          </section>

          {/* Scan history */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Scan history</h2>
            <div className="mt-3 space-y-2">
              {deviceScanResults.map((result) => (
                <div key={result.id} className="rounded-md bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span>{result.reachable ? "Reachable" : "No reply"}</span>
                    <span className="text-slate-500">{result.seenAt.toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{result.macAddress || result.hostname || result.note || "No extra details"}</p>
                </div>
              ))}
              {deviceScanResults.length === 0 ? <p className="text-sm text-slate-500">No scan history for this IP yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="self-start space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Current Loan</h2>
            {activeLoanItem ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-md bg-violet-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">{activeLoanItem.loan.loanNumber}</p>
                    <Badge className={assetLoanStatusTone[activeLoanItem.loan.status]}>{assetLoanStatusLabels[activeLoanItem.loan.status]}</Badge>
                    <Badge className={assetLoanItemReturnStatusTone[activeLoanItem.returnStatus]}>{assetLoanItemReturnStatusLabels[activeLoanItem.returnStatus]}</Badge>
                  </div>
                  <p className="mt-2 text-slate-700">
                    {activeLoanItem.loan.employee?.fullName || activeLoanItem.loan.temporaryBorrower?.name || "Unknown borrower"}
                  </p>
                  <p className="text-slate-600">Due {activeLoanItem.loan.expectedReturnAt.toLocaleDateString()}</p>
                </div>
                <div className="grid gap-2">
                  <Link href={`/loans/${activeLoanItem.loanId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                    <ClipboardList size={16} />
                    Open Loan
                  </Link>
                  {canWriteLoans ? <Link href={`/loans/${activeLoanItem.loanId}/return`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <RotateCcw size={16} />
                    Return from Loan
                  </Link> : null}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-950">Not currently loaned out</p>
                {canWriteLoans ? <Link href={`/loans/quick-checkout?assetId=${device.id}`} className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100">
                  <ClipboardList size={16} />
                  Quick Loan / Checkout
                </Link> : null}
              </div>
            )}
          </section>

          {showAssetValue ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">Asset Value</h2>
                  <p className="mt-1 text-xs text-slate-500">Internal IT estimate only, not official accounting book value.</p>
                </div>
                <CircleDollarSign className="shrink-0 text-slate-400" size={22} />
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Purchase value</p>
                  <p className="mt-1 font-semibold text-slate-950">{formatMoney(valueSummary.purchaseValue, valueCurrency)}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Current estimate</p>
                  <p className="mt-1 font-semibold text-slate-950">{formatMoney(valueSummary.currentEstimatedValue, valueCurrency)}</p>
                  <p className="text-xs text-slate-500">Age: {formatAssetAge(valueSummary.ageMonths)} / life {valueSummary.usefulLifeMonths} months</p>
                </div>
                {latestDecommissionRecord?.estimatedValueAtDecommission != null ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-medium uppercase text-rose-700">Decommission snapshot</p>
                    <p className="mt-1 font-semibold text-rose-950">{formatMoney(latestDecommissionRecord.estimatedValueAtDecommission, latestDecommissionRecord.estimatedValueCurrency ?? valueCurrency)}</p>
                  </div>
                ) : null}
                {valueSummary.reason ? <p className="text-xs text-slate-500">{valueSummary.reason}</p> : null}
                {valueSource ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-medium uppercase text-emerald-700">Source: {valueSource.label}</p>
                    <p className="mt-1 font-semibold text-emerald-950">{valueSource.facturaNumber} / {valueSource.vendorName}</p>
                    <p className="text-xs text-emerald-800">{valueSource.lineItemDescription} / {formatMoney(valueSource.unitCost, valueSource.currency)}</p>
                    <Link href={`/facturas/${valueSource.facturaId}`} className="mt-2 inline-flex min-h-10 items-center justify-center rounded-md bg-white px-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Open factura</Link>
                  </div>
                ) : null}
              </div>
              {editAssetValue ? (
                <Link href={`/devices/${device.id}/value`} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <CircleDollarSign size={16} />
                  Edit internal value
                </Link>
              ) : null}
            </section>
          ) : null}

          {bitLockerEligible ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">BitLocker Vault</h2>
                  <p className="mt-1 text-xs text-slate-500">Encrypted recovery-key tracking. Reveal is Admin-only.</p>
                </div>
                <ShieldCheck className="shrink-0 text-amber-500" size={22} />
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Protected key</p>
                  <p className="mt-1 font-semibold text-slate-950">{device.bitLockerRecoveryKey ? "Stored" : "Missing"}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Key ID</p>
                  <p className="mt-1 break-words font-semibold text-slate-950">{currentUser?.role === "VIEWER" ? (device.bitLockerRecoveryKey ? "Restricted" : "-") : device.bitLockerRecoveryKey?.keyId || "-"}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Last viewed</p>
                  <p className="mt-1 font-semibold text-slate-950">{canRevealBitLocker && device.bitLockerRecoveryKey?.lastViewedAt ? device.bitLockerRecoveryKey.lastViewedAt.toLocaleString() : device.bitLockerRecoveryKey ? "Restricted" : "-"}</p>
                </div>
                {device.bitLockerRecoveryKey && !canRevealBitLocker ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">A protected key exists. Contact an Admin to reveal it.</p> : null}
              </div>
              <div className="mt-3 grid gap-2">
                <Link href={`/devices/${device.id}/bitlocker`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <ShieldCheck size={16} />
                  Open vault
                </Link>
                {canManageBitLocker ? (
                  <Link href={`/devices/${device.id}/bitlocker/edit`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                    <Edit size={16} />
                    {device.bitLockerRecoveryKey ? "Update key" : "Add key"}
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Current RMA</h2>
            {activeRmaItem ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-md bg-amber-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-950">RMA {activeRmaItem.rmaCase.rmaNumber}</p>
                    <Badge className={rmaCaseStatusTone[activeRmaItem.rmaCase.status]}>{rmaCaseStatusLabels[activeRmaItem.rmaCase.status]}</Badge>
                    <Badge className={rmaItemResultTone[activeRmaItem.result]}>{rmaItemResultLabels[activeRmaItem.result]}</Badge>
                  </div>
                  <p className="mt-2 text-slate-700">{activeRmaItem.rmaCase.destination}{activeRmaItem.rmaCase.vendorName ? ` / ${activeRmaItem.rmaCase.vendorName}` : ""}</p>
                  <p className="text-slate-600">Sent {activeRmaItem.sentAt?.toLocaleDateString() || activeRmaItem.rmaCase.sentAt?.toLocaleDateString() || "date not set"}</p>
                </div>
                <div className="grid gap-2">
                  <Link href={`/rma/${activeRmaItem.rmaCaseId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                    <PackageCheck size={16} />
                    Open RMA
                  </Link>
                  {canWriteRma ? <Link href={`/rma/${activeRmaItem.rmaCaseId}/receive`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <RotateCcw size={16} />
                    Receive from RMA
                  </Link> : null}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-950">Not currently in active RMA</p>
                {canWriteRma ? <Link href={`/rma/new?deviceId=${device.id}`} className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100">
                  <PackageCheck size={16} />
                  Create RMA for this asset
                </Link> : null}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Current Assignment</h2>
            {isCurrentlyAssigned ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Responsibility target</p>
                  <p className="mt-1 font-semibold text-slate-950">{displayAssignedTo || "Assigned user not linked"}</p>
                  {currentEmployee?.employeeId || currentEmployee?.department ? <p className="text-slate-600">{[currentEmployee.employeeId, currentEmployee.department].filter(Boolean).join(" - ")}</p> : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Assigned date</p>
                    <p className="mt-1 font-medium text-slate-950">{activeAssignmentItem?.assignment.assignmentDate.toLocaleString() || "Not recorded"}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Status</p>
                    <p className="mt-1 font-medium text-slate-950">{activeAssignmentItem?.returnStatus.replaceAll("_", " ") || statusLabels[device.status]}</p>
                  </div>
                </div>
                {activeAssignmentItem ? (
                  <Link href={`/assignments/${activeAssignmentItem.assignmentId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 hover:text-slate-950">
                    Open assignment {activeAssignmentItem.assignment.assignmentNumber}
                  </Link>
                ) : null}
                {canWriteAssignments ? <Link href={`/devices/${device.id}/return`} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-base font-semibold text-white hover:bg-emerald-800">
                  <RotateCcw size={18} />
                  Return / Unassign
                </Link> : null}
              </div>
            ) : (
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-950">Not currently assigned</p>
                {canWriteAssignments ? <Link href="/assignments/new" className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100">
                  <UserRoundPlus size={16} />
                  Assign Equipment
                </Link> : null}
              </div>
            )}
          </section>

          {device.aliases.length || legacyAssignedValue ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-semibold text-slate-950">Legacy Identifiers</h2>
              <div className="mt-3 grid gap-2">
                {device.aliases.map((alias) => (
                  <div key={alias.id} className="rounded-md bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-medium uppercase text-slate-500">{alias.aliasType.replaceAll("_", " ")}</p>
                    <p className="mt-1 break-words font-semibold text-slate-950">{alias.value}</p>
                    {alias.sourceSheet ? <p className="text-xs text-slate-500">{alias.sourceSheet}{alias.sourceRow ? ` row ${alias.sourceRow}` : ""}</p> : null}
                  </div>
                ))}
                {legacyAssignedValue ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="text-xs font-medium uppercase text-amber-700">Imported assigned value</p>
                    <p className="mt-1 break-words font-semibold text-amber-950">{legacyAssignedValue}</p>
                    <p className="text-xs text-amber-800">Looks like a legacy asset label, not a person.</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}


        </div>
      </section>

      {device.factura ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Purchase / factura</h2>
              <p className="text-sm text-slate-600">
                {device.factura.facturaNumber} from {device.factura.vendorName}
                {device.factura.purchaseDate ? ` • ${device.factura.purchaseDate.toLocaleDateString()}` : ""}
              </p>
            </div>
            <Link href={`/facturas/${device.factura.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Open factura
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Asset Label</h2>
            <p className="text-sm text-slate-500">QR and barcode labels encode the asset tag only. Serial is separate and optional.</p>
          </div>
          {labelItem ? (
            <div className="grid gap-2 sm:flex">
              <Link href={`/labels/print?mode=existing&deviceId=${device.id}${physicalLabelCode ? "&useAlias=true" : ""}`} target="_blank" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer">
                <Printer size={16} />
                Print Label
              </Link>
              <Link href={`/labels?mode=alias-linked&deviceId=${device.id}&prefix=J&start=1&end=1&padding=2`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Tags size={16} />
                Manage physical code
              </Link>
              <Link href={`/labels?mode=existing&deviceId=${device.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Tags size={16} />
                Use asset tag
              </Link>
              <Link href={`/api/labels/zpl?mode=existing&deviceId=${device.id}${physicalLabelCode ? "&useAlias=true" : ""}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Download size={16} />
                Download ZPL
              </Link>
              {physicalLabelCode ? <CopyButton value={physicalLabelCode} label="Copy physical code" /> : null}
              {device.assetTag ? <CopyButton value={device.assetTag} label="Copy asset tag" /> : null}
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          {labelItem ? (
            <LabelPreviewCard
              item={{ ...labelItem, assetName: displayName }}
              options={{ codeType: "qr_barcode", includeSerialText: true, includeSerialCode: false, template: "standard" }}
              compact
            />
          ) : (
            <div className="rounded-md bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-950">No asset tag available for label generation.</p>
              <p className="mt-1 text-slate-500">Add an asset tag before printing a lookup label for this asset.</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">RMA history</h2>
            <p className="text-sm text-slate-500">Past and active repair batches for this asset.</p>
          </div>
          {canWriteRma ? <Link href={`/rma/new?deviceId=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <PackageCheck size={16} />
            Create RMA
          </Link> : null}
        </div>
        <div className="mt-4 grid gap-3">
          {device.rmaItems.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/rma/${item.rmaCaseId}`} className="font-semibold text-slate-950 hover:underline">RMA {item.rmaCase.rmaNumber}</Link>
                    <Badge className={rmaCaseStatusTone[item.rmaCase.status]}>{rmaCaseStatusLabels[item.rmaCase.status]}</Badge>
                    <Badge className={rmaItemResultTone[item.result]}>{rmaItemResultLabels[item.result]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.rmaCase.destination}{item.rmaCase.vendorName ? ` / ${item.rmaCase.vendorName}` : ""}</p>
                  <p className="text-sm text-slate-500">Sent {item.sentAt?.toLocaleDateString() || item.rmaCase.sentAt?.toLocaleDateString() || "not recorded"}{item.returnedAt ? ` / returned ${item.returnedAt.toLocaleDateString()}` : ""}</p>
                  {item.notes ? <p className="mt-2 text-sm text-slate-600">{item.notes}</p> : null}
                </div>
                <Link href={`/rma/${item.rmaCaseId}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Open</Link>
              </div>
            </div>
          ))}
          {device.rmaItems.length === 0 ? <p className="text-sm text-slate-500">No RMA history for this asset yet.</p> : null}
        </div>
      </section>

      <AssetPhotoPanel
        assetId={device.id}
        photos={device.photos}
        asset={{
          category: device.category,
          condition: device.condition,
          status: device.status,
          isFixedAsset: device.isFixedAsset,
          usesStaticIp: device.usesStaticIp,
          rmaItems: device.rmaItems,
          assignmentItems: device.assignmentItems,
          assetLoanItems: device.assetLoanItems,
        }}
      />

      {supportsMaintenance ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">{isScale ? "Scale maintenance / calibration" : "Printer maintenance"}</h2>
              <p className="text-sm text-slate-500">{isScale ? "Manual calibration checks, weight tests, cleaning, and follow-up." : "Manual supply levels, test prints, parts, and scheduled printer care."}</p>
            </div>
            <div className="grid gap-2 sm:flex">
              <Link href={`/devices/${device.id}/maintenance`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">View history</Link>
              {canWriteInventory ? <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                <Wrench size={16} />
                Add record
              </Link> : null}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Schedule status", maintenanceStatusLabel(maintenanceSummary.status)],
              ["Last result", maintenanceSummary.lastResult ? maintenanceResultLabels[maintenanceSummary.lastResult] : "-"],
              ["Next due", maintenanceSummary.nextDueAt ? maintenanceSummary.nextDueAt.toLocaleDateString() : "No schedule"],
              ["Failed/follow-up", maintenanceSummary.failedOrFollowUp.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {device.category === "MFP_PRINTER"
              ? [
                  ["Black toner", device.blackTonerLevel != null ? `${device.blackTonerLevel}%` : "-"],
                  ["Cyan toner", device.cyanTonerLevel != null ? `${device.cyanTonerLevel}%` : "-"],
                  ["Magenta toner", device.magentaTonerLevel != null ? `${device.magentaTonerLevel}%` : "-"],
                  ["Yellow toner", device.yellowTonerLevel != null ? `${device.yellowTonerLevel}%` : "-"],
                  ["Drum", device.drumLevel != null ? `${device.drumLevel}%` : "-"],
                  ["Page count", device.pageCount ?? "-"],
                  ["Supply threshold", device.lowSupplyThreshold != null ? `${device.lowSupplyThreshold}%` : "Default"],
                  ["Last supply replacement", device.lastSupplyReplacementAt ? device.lastSupplyReplacementAt.toLocaleDateString() : "-"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                  </div>
                ))
              : isScale
                ? [
                  ["Calibration/check due", device.maintenanceDueAt ? device.maintenanceDueAt.toLocaleDateString() : "-"],
                  ["Last check", latestMaintenance ? latestMaintenance.performedAt.toLocaleDateString() : "-"],
                  ["Last type", latestMaintenance ? maintenanceTypeLabels[latestMaintenance.maintenanceType] : "-"],
                  ["Test weight", latestMaintenance?.testWeight ?? "-"],
                  ["Expected value", latestMaintenance?.expectedValue ?? "-"],
                  ["Measured value", latestMaintenance?.measuredValue ?? "-"],
                  ["Location", device.location || device.areaDepartment || "-"],
                  ["IP/MAC", [device.ipAddress, device.macAddress].filter(Boolean).join(" / ") || "-"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                  </div>
                ))
                : [
                  ["Last cleaned", device.lastCleanedAt ? device.lastCleanedAt.toLocaleDateString() : "Not recorded"],
                  ["Cleaning interval", `${device.cleaningIntervalDays ?? 30} days`],
                  ["Printhead replaced", device.lastPrintheadReplacementAt ? device.lastPrintheadReplacementAt.toLocaleDateString() : "-"],
                  ["Platen roller replaced", device.lastPlatenRollerReplacementAt ? device.lastPlatenRollerReplacementAt.toLocaleDateString() : "-"],
                  ["Cutter replaced", device.lastCutterReplacementAt ? device.lastCutterReplacementAt.toLocaleDateString() : "-"],
                  ["Maintenance due", device.maintenanceDueAt ? device.maintenanceDueAt.toLocaleDateString() : "-"],
                  ["Last maintenance", latestMaintenance ? latestMaintenance.performedAt.toLocaleDateString() : "-"],
                  ["Estimated printhead life", device.estimatedPrintheadLife ?? "-"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
          </div>
          {device.maintenanceNotes ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{device.maintenanceNotes}</p> : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-slate-950">Maintenance history</h2>
          {canWriteInventory ? <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Wrench size={16} />
            Add record
          </Link> : null}
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {device.maintenanceRecords.map((record) => (
            <div key={record.id} className="py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{maintenanceTypeLabels[record.maintenanceType]}</p>
                <p className="text-slate-500">{record.performedAt.toLocaleString()}</p>
              </div>
              <p className="text-slate-600">
                {record.performedBy || "No technician recorded"}
                {record.stockItem ? ` - used ${record.quantityUsed ?? 0} ${record.stockItem.name}` : ""}
              </p>
              {record.notes ? <p className="text-slate-500">{record.notes}</p> : null}
            </div>
          ))}
          {device.maintenanceRecords.length === 0 ? <p className="text-sm text-slate-500">No maintenance history yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Last 5 Locations</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {locationHistory.map((item) => (
            <div key={item.id} className="py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{item.locationLabel}</p>
                <p className="text-slate-500">{item.seenAt.toLocaleString()}</p>
              </div>
              <p className="text-slate-600">
                {item.apName}
                {item.signalStrength != null ? ` • ${item.signalStrength} dBm` : ""}
              </p>
            </div>
          ))}
          {locationHistory.length === 0 ? <p className="text-sm text-slate-500">No location updates yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Assignment history</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {device.assignmentItems.map((item) => (
            <Link key={item.id} href={`/assignments/${item.assignmentId}`} className="block py-3 text-sm hover:bg-slate-50">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{item.assignment.assignmentNumber}</p>
                <p className="text-slate-500">{item.assignment.assignmentDate.toLocaleString()}</p>
              </div>
              <p className="text-slate-600">Responsible: {assignmentResponsibleLabel(item.assignment)} - {item.returnStatus.replaceAll("_", " ")}</p>
            </Link>
          ))}
          {device.assignmentItems.length === 0 ? <p className="text-sm text-slate-500">No assignment history yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Notes/history log</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {activity.map((item) => (
            <div key={item.id} className="py-3 text-sm">
              <p className="font-medium text-slate-950">{item.message}</p>
              <p className="text-slate-500">{item.createdAt.toLocaleString()}</p>
            </div>
          ))}
          {activity.length === 0 ? <p className="text-sm text-slate-500">No logged actions for this device yet.</p> : null}
        </div>
      </section>

      <nav className="fixed inset-x-3 bottom-24 z-30 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur lg:hidden">
        {canWriteInventory ? <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-lg bg-slate-950 px-2 text-sm font-semibold text-white">
          <Edit size={16} />
          Edit
        </Link> : null}
        <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-sm font-semibold text-slate-700">
          <ScanLine size={16} />
          Scan
        </Link>
        <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-sm font-semibold text-slate-700">
          <MapPin size={16} />
          Map
        </Link>
        {canWriteInventory && moveUseful ? (
          <Link href={`/devices/${device.id}/move`} className="col-span-3 inline-flex min-h-12 items-center justify-center gap-1 rounded-lg bg-sky-700 px-2 text-sm font-semibold text-white">
            <Truck size={16} />
            Move / Relocate
          </Link>
        ) : null}
        {canWriteAssignments && isCurrentlyAssigned ? (
          <Link href={`/devices/${device.id}/return`} className="col-span-3 inline-flex min-h-12 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2 text-sm font-semibold text-white">
            <RotateCcw size={16} />
            Return / Unassign
          </Link>
        ) : null}
      </nav>

      {canWriteInventory ? <details className="rounded-lg border border-rose-200 bg-white p-4">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-rose-700">More / danger actions</summary>
        <div className="mt-3">
          <Link href={`/devices/${device.id}/decommission`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800">
            <ArchiveX size={16} />
            Open controlled decommission
          </Link>
        </div>
      </details> : null}
    </div>
  );
}
