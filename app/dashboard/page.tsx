import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, ClipboardCheck, Database, ExternalLink, MapPin, Network, Package, Plus, Router, ScanLine, SearchX, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { categoryLabels, severityTone, statusTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";
import { isIpInRange, rangeSize, validateIpRange } from "@/lib/ip";
import { buildPrinterAlertCandidates } from "@/lib/maintenance-alerts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [devices, ranges, recent, recentLocationCount, onlineTrackedAssets, stockItems, recentMaintenance, recentStockUsage, openAlerts, activeAssignments, openTasks, tasksDueToday, overdueTasks, poFollowUpsDue, posAwaitingFactura, favoriteTools] = await Promise.all([
    prisma.device.findMany({ include: { ipRange: true } }),
    prisma.ipRange.findMany({ where: { active: true }, include: { devices: true } }),
    prisma.device.findMany({ orderBy: { updatedAt: "desc" }, take: 6, include: { ipRange: true } }),
    prisma.assetLocationHistory.count({ where: { seenAt: { gte: oneDayAgo } } }),
    prisma.unifiClientSnapshot.findMany({ where: { online: true, assetId: { not: null } }, distinct: ["assetId"], select: { assetId: true } }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: { quantityOnHand: "asc" }, take: 100 }),
    prisma.maintenanceRecord.findMany({ orderBy: { performedAt: "desc" }, take: 5, include: { asset: true, stockItem: true } }),
    prisma.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { stockItem: true, asset: true, employee: true } }),
    prisma.alert.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    prisma.assignment.count({ where: { status: "ACTIVE" } }),
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] } } }),
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] }, dueDate: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) } } }),
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] }, dueDate: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
    prisma.purchaseNote.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] }, followUpDate: { lte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
    prisma.purchaseNote.count({ where: { status: "FACTURA_PENDING" } }),
    prisma.toolLink.findMany({ where: { active: true, isFavorite: true }, orderBy: { name: "asc" }, take: 5 }),
  ]);

  const conflicts = detectInventoryConflicts(devices);
  const usedDevices = devices.filter((device) => ["ACTIVE", "RESERVED"].includes(device.status));
  const totalCapacity = ranges.reduce((total, range) => total + (validateIpRange(range.startIp, range.endIp).ok ? rangeSize(range.startIp, range.endIp) : 0), 0);
  const usedInPools = usedDevices.filter((device) =>
    device.ipAddress && ranges.some((range) => validateIpRange(range.startIp, range.endIp).ok && isIpInRange(device.ipAddress!, range.startIp, range.endIp)),
  ).length;
  const categoryCounts = Object.keys(categoryLabels).map((category) => ({
    category,
    count: devices.filter((device) => device.category === category).length,
  }));
  const lowStockItems = stockItems.filter((item) => item.quantityOnHand <= item.minimumQuantity);
  const printerAlerts = buildPrinterAlertCandidates(devices);
  const thermalCleaningDue = printerAlerts.filter((alert) => alert.type === "THERMAL_CLEANING_DUE").length;
  const mfpSuppliesLow = printerAlerts.filter((alert) => ["MFP_LOW_TONER", "MFP_LOW_INK", "MFP_DRUM_LOW", "MFP_MAINTENANCE_KIT_DUE"].includes(alert.type)).length;
  const missingAssets = devices.filter((device) => device.status === "MISSING").length;
  const availableAssets = devices.filter((device) => device.status === "AVAILABLE").length;
  const assignedAssets = devices.filter((device) => device.status === "IN_USE_ASSIGNED").length;
  const maintenanceDue = printerAlerts.length;

  const primaryCards = [
    { label: "Open Alerts", value: openAlerts, icon: AlertTriangle, href: "/alerts", tone: openAlerts ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white" },
    { label: "Missing Assets", value: missingAssets, icon: SearchX, href: "/missing", tone: missingAssets ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white" },
    { label: "Available Assets", value: availableAssets, icon: Database, href: "/devices?status=AVAILABLE", tone: "border-slate-200 bg-white" },
    { label: "Assigned Assets", value: assignedAssets, icon: ClipboardCheck, href: "/devices?status=IN_USE_ASSIGNED", tone: "border-slate-200 bg-white" },
    { label: "Low Stock", value: lowStockItems.length, icon: Package, href: "/stock?lowOnly=true", tone: lowStockItems.length ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white" },
    { label: "Maintenance Due", value: maintenanceDue, icon: Wrench, href: "/alerts?source=PRINTER", tone: maintenanceDue ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white" },
  ];

  const secondaryCards = [
    { label: "Total devices", value: devices.length, icon: Database },
    { label: "Used IPs", value: usedDevices.length, icon: Network },
    { label: "Available IPs", value: Math.max(totalCapacity - usedInPools, 0), icon: Router },
    { label: "Possible conflicts", value: conflicts.length, icon: AlertTriangle },
    { label: "Recent locations", value: recentLocationCount, icon: Network },
    { label: "Online Wi-Fi assets", value: onlineTrackedAssets.length, icon: Router },
    { label: "Not seen recently", value: devices.filter((device) => !device.lastSeenAt || device.lastSeenAt < sevenDaysAgo).length, icon: Database },
    { label: "Thermal cleaning due", value: thermalCleaningDue, icon: Wrench },
    { label: "MFP supplies low", value: mfpSuppliesLow, icon: Package },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="At-a-glance warehouse IP usage, reserved pools, and conflict signals."
        action={
          <div className="grid gap-2 sm:flex">
            <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 sm:min-h-12 sm:text-sm" href="/scan">
              <ScanLine size={16} />
              Quick Scan
            </Link>
            <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12 sm:text-sm" href="/devices/new">
              <Plus size={16} />
              Add Asset
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Link href="/scan" className="flex min-h-20 items-center justify-center gap-3 rounded-lg bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 sm:hidden">
          <ScanLine size={22} />
          Scan asset or stock label
        </Link>
        <Link href="/alerts" className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:hidden">
          <AlertTriangle size={18} />
          Open alerts
        </Link>
        <Link href="/missing" className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:hidden">
          <MapPin size={18} />
          Missing assets
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {primaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href} className={`rounded-lg border p-4 hover:shadow-sm ${card.tone}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">{card.label}</p>
                <Icon className="text-slate-500" size={20} />
              </div>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{card.value}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-600">Active assignments</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{activeAssignments}</p>
          <Link href="/assignments" className="mt-3 inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Open assignments</Link>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-600">Low stock / maintenance due</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{lowStockItems.length + maintenanceDue}</p>
          <Link href="/alerts" className="mt-3 inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Review alerts</Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Workspace</h2>
            <p className="text-sm text-slate-500">Lightweight IT follow-ups and purchase notes.</p>
          </div>
          <Link href="/workspace" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <BriefcaseBusiness size={16} />
            Open
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Open Tasks", openTasks, "/tasks"],
            ["Due Today", tasksDueToday, "/tasks?dueToday=true"],
            ["Overdue Tasks", overdueTasks, "/tasks?overdue=true"],
            ["PO Follow-ups", poFollowUpsDue, "/po-tracker?followUpDue=true"],
            ["Awaiting Factura", posAwaitingFactura, "/po-tracker?facturaPending=true"],
          ].map(([label, value, href]) => (
            <Link key={String(label)} href={String(href)} className="rounded-md bg-slate-50 p-3 hover:bg-slate-100">
              <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            </Link>
          ))}
        </div>
        {favoriteTools.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {favoriteTools.map((tool) => (
              <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ExternalLink size={15} />
                {tool.name}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <details className="rounded-lg border border-slate-200 bg-white p-4" open={false}>
        <summary className="flex min-h-11 items-center justify-between text-sm font-semibold text-slate-950">
          Secondary metrics
          <span className="text-xs text-slate-500">Tap to expand</span>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {secondaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <Icon className="text-slate-400" size={18} />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{card.value}</p>
            </div>
          );
        })}
        </div>
      </details>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Categories</h2>
          <div className="mt-4 space-y-3">
            {categoryCounts.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{categoryLabels[item.category as keyof typeof categoryLabels]}</span>
                <span className="font-semibold text-slate-950">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">VLAN/range summary</h2>
          <div className="mt-4 space-y-3">
            {ranges.map((range) => {
              const capacity = validateIpRange(range.startIp, range.endIp).ok ? rangeSize(range.startIp, range.endIp) : 0;
              const used = usedDevices.filter((device) => device.ipAddress && isIpInRange(device.ipAddress, range.startIp, range.endIp)).length;
              return (
                <div key={range.id} className="rounded-md bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-950">{range.name}</span>
                    <span className="text-slate-500">VLAN {range.vlan}</span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {used}/{capacity} used, {Math.max(capacity - used, 0)} available
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Recently updated</h2>
          <div className="mt-4 space-y-3">
            {recent.map((device) => (
              <Link key={device.id} href={`/devices/${device.id}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-950">{device.name}</span>
                  <Badge className={statusTone[device.status]}>{device.status.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-1 font-mono text-slate-600">{device.ipAddress}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-950">Low stock</h2>
            <Link href="/stock?lowOnly=true" className="text-sm font-semibold text-slate-700 hover:text-slate-950">View</Link>
          </div>
          <div className="mt-3 space-y-2">
            {lowStockItems.slice(0, 5).map((item) => (
              <Link key={item.id} href={`/stock/${item.id}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-950">{item.name}</span>
                  <Badge className="bg-rose-100 text-rose-800 ring-rose-200">{item.quantityOnHand}/{item.minimumQuantity}</Badge>
                </div>
                <p className="text-slate-500">{item.storageLocation || "No location"}</p>
              </Link>
            ))}
            {lowStockItems.length === 0 ? <p className="text-sm text-slate-500">No stock below minimum.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Recent maintenance</h2>
          <div className="mt-3 space-y-2">
            {recentMaintenance.map((record) => (
              <Link key={record.id} href={`/devices/${record.assetId}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                <p className="font-medium text-slate-950">{record.asset.name}</p>
                <p className="text-slate-500">{record.maintenanceType.replaceAll("_", " ")} - {record.performedAt.toLocaleString()}</p>
              </Link>
            ))}
            {recentMaintenance.length === 0 ? <p className="text-sm text-slate-500">No maintenance records yet.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Recent stock usage</h2>
          <div className="mt-3 space-y-2">
            {recentStockUsage.map((movement) => (
              <Link key={movement.id} href={`/stock/${movement.stockItemId}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                <p className="font-medium text-slate-950">{movement.stockItem.name}</p>
                <p className="text-slate-500">{movement.movementType.replaceAll("_", " ")} - {movement.previousQuantity} to {movement.newQuantity}</p>
              </Link>
            ))}
            {recentStockUsage.length === 0 ? <p className="text-sm text-slate-500">No stock movement history yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-950">Possible conflicts</h2>
          <Link href="/conflicts" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
            View all
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {conflicts.slice(0, 5).map((conflict) => (
            <div key={`${conflict.type}-${conflict.title}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-950">{conflict.title}</p>
                <p className="text-sm text-slate-600">{conflict.description}</p>
              </div>
              <Badge className={severityTone[conflict.severity]}>{conflict.severity}</Badge>
            </div>
          ))}
          {conflicts.length === 0 ? <p className="p-4 text-sm text-slate-500">No active conflicts detected.</p> : null}
        </div>
      </section>
    </div>
  );
}
