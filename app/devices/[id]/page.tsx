import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Edit, MapPin, Route, ScanLine, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { RetireButton } from "@/components/retire-button";
import { AssetPhotoPanel } from "@/components/asset-photo-panel";
import { categoryLabels, maintenanceTypeLabels, severityTone, statusLabels, statusTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DeviceDetailPage({ params }: Props) {
  const { id } = await params;
  const [device, allDevices, activity] = await Promise.all([
    prisma.device.findUnique({
      where: { id },
      include: {
        ipRange: true,
        employee: true,
        factura: true,
        expectedLocationZone: true,
        photos: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
        maintenanceRecords: { include: { stockItem: true }, orderBy: { performedAt: "desc" }, take: 10 },
        assignmentItems: { include: { assignment: { include: { employee: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.device.findMany({ include: { ipRange: true } }),
    prisma.activityLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  if (!device) notFound();

  const [deviceScanResults, locationHistory, latestUnifiSnapshot] = await Promise.all([
    device.ipAddress ? prisma.scanResult.findMany({ where: { ipAddress: device.ipAddress }, orderBy: { seenAt: "desc" }, take: 10 }) : Promise.resolve([]),
    prisma.assetLocationHistory.findMany({ where: { assetId: device.id }, orderBy: { seenAt: "desc" }, take: 5 }),
    prisma.unifiClientSnapshot.findFirst({ where: { assetId: device.id }, orderBy: { syncedAt: "desc" } }),
  ]);
  const conflicts = detectInventoryConflicts(allDevices).filter((conflict) => conflict.affectedDeviceIds?.includes(id));
  const lastKnownLocation = locationHistory[0];
  const isPrinter = ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"].includes(device.category);
  const latestMaintenance = device.maintenanceRecords[0];

  const fields = [
    ["Asset tag", device.assetTag || "-"],
    ["Category", categoryLabels[device.category]],
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
    ["Assigned to", device.employee?.fullName || device.assignedTo || "-"],
    ["Fixed/static movement", device.movementAlertsEnabled ? `Enabled - expected ${device.expectedLocationZone?.name || "zone not set"}` : "Disabled"],
    ["Factura", device.factura ? `${device.factura.facturaNumber} - ${device.factura.vendorName}` : "-"],
    ["Purchase date", device.purchaseDate ? device.purchaseDate.toLocaleDateString() : "-"],
    ["Warranty expires", device.warrantyExpiresAt ? device.warrantyExpiresAt.toLocaleDateString() : "-"],
    ["Last seen", device.lastSeenAt ? device.lastSeenAt.toLocaleString() : "Never"],
    ["Created", device.createdAt.toLocaleString()],
    ["Updated", device.updatedAt.toLocaleString()],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={device.name}
        description={`${device.ipAddress || "No IP"}${device.vlan ? ` on VLAN ${device.vlan}` : ""}`}
        action={
          <div className="grid gap-2 sm:flex">
            <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              <Edit size={16} />
              Edit
            </Link>
            <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ScanLine size={16} />
              Scan
            </Link>
            <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <MapPin size={16} />
              Map
            </Link>
            <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Wrench size={16} />
              Add maintenance
            </Link>
            <Link href={`/tasks/new?relatedDeviceId=${device.id}&category=INVENTORY&title=${encodeURIComponent(`Follow up ${device.name}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ClipboardList size={16} />
              Create Task
            </Link>
            <RetireButton id={device.id} />
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusTone[device.status]}>{statusLabels[device.status]}</Badge>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{categoryLabels[device.category]}</Badge>
            {conflicts.length ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Conflict flagged</Badge> : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Asset tag", device.assetTag || "-"],
              ["Location", device.location || "-"],
              ["Assigned", device.employee?.fullName || device.assignedTo || "Unassigned"],
              ["IP", device.ipAddress || "No IP"],
              ["Serial", device.serialNumber || "-"],
              ["Last known", lastKnownLocation?.locationLabel || "Unknown"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
            <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-800">
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
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Last Known Location</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Last seen</p>
                <p className="mt-1 font-medium text-slate-950">{lastKnownLocation?.seenAt.toLocaleString() ?? device.lastSeenAt?.toLocaleString() ?? "Unknown"}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Access point</p>
                <p className="mt-1 font-medium text-slate-950">{lastKnownLocation?.apName ?? "No UniFi AP location yet"}</p>
                <p className="text-slate-600">{lastKnownLocation?.locationLabel ?? "Configure AP coordinates on the map page."}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Current UniFi status</p>
                <p className="mt-1 font-medium text-slate-950">{latestUnifiSnapshot?.online ? "Online" : latestUnifiSnapshot ? "Offline" : "Unknown"}</p>
                <p className="text-slate-600">{latestUnifiSnapshot?.syncedAt ? `Synced ${latestUnifiSnapshot.syncedAt.toLocaleString()}` : "No read-only UniFi sync snapshot yet."}</p>
              </div>
              <div className="grid gap-2">
                <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                  <MapPin size={16} />
                  View on Map
                </Link>
                <Link href={`/map?asset=${device.id}&history=5`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <Route size={16} />
                  View Last 5 Locations
                </Link>
              </div>
            </div>
          </section>

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

      <AssetPhotoPanel assetId={device.id} photos={device.photos} />

      {isPrinter ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Printer maintenance</h2>
              <p className="text-sm text-slate-500">Manual supply levels and scheduled printer care. Thermal and MFP alerts stay separate.</p>
            </div>
            <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Wrench size={16} />
              Add maintenance record
            </Link>
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
          <Link href={`/devices/${device.id}/maintenance/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <Wrench size={16} />
            Add record
          </Link>
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
          {locationHistory.length === 0 ? <p className="text-sm text-slate-500">No AP-based location history yet.</p> : null}
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
              <p className="text-slate-600">Assigned to {item.assignment.employee.fullName} • {item.returnStatus.replaceAll("_", " ")}</p>
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
        <Link href={`/devices/${device.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-lg bg-slate-950 px-2 text-sm font-semibold text-white">
          <Edit size={16} />
          Edit
        </Link>
        <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-sm font-semibold text-slate-700">
          <ScanLine size={16} />
          Scan
        </Link>
        <Link href={`/map?asset=${device.id}`} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-sm font-semibold text-slate-700">
          <MapPin size={16} />
          Map
        </Link>
      </nav>
    </div>
  );
}
