import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, ClipboardCheck, ClipboardList, Database, ExternalLink, FileSpreadsheet, ListChecks, Network, Package, PackageCheck, Plus, ReceiptText, ScanLine, SearchX, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { categoryLabels, severityTone, statusLabels, statusTone } from "@/lib/constants";
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

  const [devices, ranges, recent, recentLocationCount, stockItems, recentMaintenance, recentStockUsage, openAlerts, activeAssignments, openTasks, tasksDueToday, overdueTasks, poFollowUpsDue, posAwaitingFactura, favoriteTools, activeRmas, rmaFollowUpsDue, devicesInRma, activeStockLoans, overdueStockLoans, activeAssetLoans, overdueAssetLoans] = await Promise.all([
    prisma.device.findMany({ include: { ipRange: true } }),
    prisma.ipRange.findMany({ where: { active: true } }),
    prisma.device.findMany({ orderBy: { updatedAt: "desc" }, take: 6, include: { ipRange: true } }),
    prisma.assetLocationHistory.count({ where: { seenAt: { gte: oneDayAgo } } }),
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
    prisma.rmaCase.count({ where: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } }),
    prisma.rmaCase.count({ where: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] }, expectedFollowUpAt: { lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) } } }),
    prisma.rmaItem.count({ where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } } }),
    prisma.stockIssue.count({ where: { issueType: "LOAN", status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } }),
    prisma.stockIssue.count({ where: { issueType: "LOAN", status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] }, expectedReturnAt: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
    prisma.assetLoan.count({ where: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } }),
    prisma.assetLoan.count({ where: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] }, expectedReturnAt: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
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
  const repairAssets = devices.filter((device) => device.status === "IN_REPAIR_RMA").length;
  const maintenanceDue = printerAlerts.length;

  const dailyActions = [
    { title: "Scan an asset", helper: "Scan, check status, take action.", href: "/scan", icon: ScanLine, primary: true },
    { title: "Search inventory", helper: "Find devices, owners, locations.", href: "/devices", icon: Database },
    { title: "Add asset", helper: "Create a new inventory record.", href: "/intake/assets/new", icon: Plus },
    { title: "Assign equipment", helper: "Start or review assignments.", href: "/assignments", icon: ClipboardCheck },
    { title: "Loan serialized asset", helper: activeAssetLoans ? `${activeAssetLoans} active asset loan${activeAssetLoans === 1 ? "" : "s"}.` : "Temporary checkout for devices.", href: "/loans/quick-checkout", icon: ClipboardList },
    { title: "Use stock", helper: activeStockLoans ? `${activeStockLoans} active stock loan${activeStockLoans === 1 ? "" : "s"}.` : "Check, add, or hand out items.", href: "/stock/issue", icon: Package },
    { title: "RMA / repair", helper: activeRmas ? `${activeRmas} active repair batch${activeRmas === 1 ? "" : "es"}.` : "Create or receive repair batches.", href: "/rma", icon: PackageCheck },
    { title: "Review alerts", helper: openAlerts ? `${openAlerts} open alert${openAlerts === 1 ? "" : "s"}.` : "No open alerts.", href: "/alerts", icon: AlertTriangle },
    { title: "Import inventory", helper: "Preview a legacy workbook import.", href: "/import/legacy-sheet", icon: FileSpreadsheet },
    { title: "Open IT tools", helper: "Jump to common portals and docs.", href: "/tools", icon: ExternalLink },
  ];

  const attentionCards = [
    { label: "Open Alerts", value: openAlerts, helper: openAlerts ? "Needs review" : "No open alerts", icon: AlertTriangle, href: "/alerts", tone: openAlerts ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { label: "Maintenance Due", value: maintenanceDue, helper: maintenanceDue ? "Printer or device work due" : "Maintenance is clear", icon: Wrench, href: "/alerts?source=PRINTER", tone: maintenanceDue ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { label: "Low Stock", value: lowStockItems.length, helper: lowStockItems.length ? "Items at or below minimum" : "Stock looks okay", icon: Package, href: "/stock?lowOnly=true", tone: lowStockItems.length ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { label: "Missing Assets", value: missingAssets, helper: missingAssets ? "Check map and recent sightings" : "No missing assets", icon: SearchX, href: "/missing", tone: missingAssets ? "border-rose-200/70 bg-rose-50/30 hover:border-rose-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { label: "Tasks Due", value: overdueTasks + tasksDueToday, helper: overdueTasks ? `${overdueTasks} overdue` : tasksDueToday ? "Due today" : "No tasks due today", icon: ListChecks, href: overdueTasks ? "/tasks?overdue=true" : "/tasks?dueToday=true", tone: overdueTasks ? "border-rose-200/70 bg-rose-50/30 hover:border-rose-400/70" : tasksDueToday ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
  ];

  const inventoryCards = [
    { label: "Total Assets", value: devices.length, helper: "All inventory records", icon: Database, href: "/devices" },
    { label: "Available", value: availableAssets, helper: availableAssets ? "Ready to assign" : "No available assets", icon: Database, href: "/devices?status=AVAILABLE" },
    { label: "Assigned", value: assignedAssets, helper: assignedAssets ? "Currently in use" : "No assigned assets", icon: ClipboardCheck, href: "/devices?status=IN_USE_ASSIGNED" },
    { label: "In Repair/RMA", value: repairAssets, helper: repairAssets ? "Needs follow-up" : "No repair queue", icon: Wrench, href: "/devices?status=IN_REPAIR_RMA" },
    { label: "Missing", value: missingAssets, helper: missingAssets ? "Needs location review" : "Nothing marked missing", icon: SearchX, href: "/missing" },
  ];

  const workspaceCards = [
    { label: "Open Tasks", value: openTasks, helper: openTasks ? "Active follow-ups" : "No open tasks", href: "/tasks", icon: ListChecks },
    { label: "Due Today", value: tasksDueToday, helper: tasksDueToday ? "Due before end of day" : "No tasks due today", href: "/tasks?dueToday=true", icon: ClipboardCheck },
    { label: "PO Follow-ups", value: poFollowUpsDue, helper: poFollowUpsDue ? "Vendor or purchase follow-up" : "No PO follow-ups due", href: "/po-tracker?followUpDue=true", icon: ReceiptText },
    { label: "Awaiting Factura", value: posAwaitingFactura, helper: posAwaitingFactura ? "Waiting on invoice records" : "No pending facturas", href: "/po-tracker?facturaPending=true", icon: FileSpreadsheet },
    { label: "Favorite Tools", value: favoriteTools.length, helper: favoriteTools.length ? "Pinned resources ready" : "No favorites yet", href: "/tools", icon: ExternalLink },
    { label: "Stock Loans", value: activeStockLoans, helper: overdueStockLoans ? `${overdueStockLoans} overdue` : "Active stock loans", href: overdueStockLoans ? "/stock/issues?view=overdue" : "/stock/issues?view=active", icon: Package },
    { label: "Asset Loans", value: activeAssetLoans, helper: overdueAssetLoans ? `${overdueAssetLoans} overdue` : "Active serialized checkouts", href: overdueAssetLoans ? "/loans?view=overdue" : "/loans?view=active", icon: ClipboardList },
    { label: "Active RMAs", value: activeRmas, helper: activeRmas ? `${devicesInRma} devices in repair` : "No active repair batches", href: "/rma", icon: PackageCheck },
    { label: "RMA Follow-ups", value: rmaFollowUpsDue, helper: rmaFollowUpsDue ? "Follow up due" : "No RMA follow-ups due", href: "/rma?followUpDue=true", icon: AlertTriangle },
  ];

  const secondaryCards = [
    { label: "Used IPs", value: usedDevices.length, icon: Network },
    { label: "Available IPs", value: Math.max(totalCapacity - usedInPools, 0), icon: Network },
    { label: "Possible conflicts", value: conflicts.length, icon: AlertTriangle },
    { label: "Manual location updates", value: recentLocationCount, icon: Network },
    { label: "Not seen recently", value: devices.filter((device) => !device.lastSeenAt || device.lastSeenAt < sevenDaysAgo).length, icon: Database },
    { label: "Thermal cleaning due", value: thermalCleaningDue, icon: Wrench },
    { label: "MFP supplies low", value: mfpSuppliesLow, icon: Package },
    { label: "Active assignments", value: activeAssignments, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Start with the daily warehouse IT workflow, then drill into the details only when you need them."
        action={
          <div className="grid gap-2 sm:flex">
            <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 sm:min-h-12 sm:text-sm" href="/scan">
              <ScanLine size={16} />
              Quick Scan
            </Link>
            <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12 sm:text-sm" href="/intake/assets/new">
              <Plus size={16} />
              Add Asset
            </Link>
          </div>
        }
      />

      <section className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start here</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">What do you want to do today?</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dailyActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className={`flex min-h-24 items-start gap-3 rounded-lg border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
                  action.primary 
                    ? "border-slate-950 bg-gradient-to-br from-[#0B0F19] to-[#1E293B] text-white hover:from-[#111827] hover:to-[#334155] shadow-sm" 
                    : "border-slate-200 bg-white text-slate-950 hover:border-blue-500/30"
                }`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${action.primary ? "bg-white/15" : "bg-slate-100 text-slate-700"}`}>
                  <Icon size={20} className={action.primary ? "text-orange-400" : ""} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{action.title}</span>
                  <span className={`mt-1 block text-sm ${action.primary ? "text-slate-200" : "text-slate-500"}`}>{action.helper}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Needs Attention</h2>
            <p className="text-sm text-slate-500">Only the daily signals that usually need action.</p>
          </div>
          <Link href="/alerts" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 hover:text-slate-950">
            Review alert center
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {attentionCards.map((card) => {
            const Icon = card.icon;
            const needsAction = card.value > 0;
            return (
              <Link key={card.label} href={card.href} className={`rounded-lg border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${card.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{card.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{card.helper}</p>
                  </div>
                  <span className="flex flex-col items-end gap-2">
                    <Icon className={needsAction ? "text-amber-700" : "text-emerald-700"} size={20} />
                    <Badge tone={needsAction ? (card.label === "Missing Assets" || card.label === "Tasks Due" && overdueTasks ? "danger" : "warning") : "success"}>
                      {needsAction ? "Review" : "Healthy"}
                    </Badge>
                  </span>
                </div>
                <p className="mt-4 text-4xl font-semibold text-slate-950">{card.value}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Inventory Snapshot</h2>
          <p className="text-sm text-slate-500">A quick read on asset availability and exceptions.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {inventoryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} href={card.href} className="rounded-lg border border-slate-200/80 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{card.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{card.helper}</p>
                  </div>
                  <Icon className="text-slate-400" size={20} />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">{card.value}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Workspace Snapshot</h2>
            <p className="text-sm text-slate-500">Lightweight tasks, purchase follow-ups, and quick links.</p>
          </div>
          <Link href="/workspace" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950">
            <BriefcaseBusiness size={16} />
            Open workspace
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {workspaceCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} href={card.href} className="rounded-lg border border-slate-200/80 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-slate-300">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{card.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{card.helper}</p>
                  </div>
                  <Icon className="text-slate-400" size={20} />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">{card.value}</p>
              </Link>
            );
          })}
        </div>
        {favoriteTools.length ? (
          <div className="flex flex-wrap gap-2">
            {favoriteTools.map((tool) => (
              <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <ExternalLink size={15} />
                {tool.name}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-950">
          <span>Secondary Metrics</span>
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">Advanced inventory, IPAM, and recent activity</span>
        </summary>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">Categories</h3>
            <div className="mt-4 space-y-3">
              {categoryCounts.map((item) => (
                <div key={item.category} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-slate-600">{categoryLabels[item.category as keyof typeof categoryLabels]}</span>
                  <span className="font-semibold text-slate-950">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">VLAN/range summary</h3>
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
              {ranges.length === 0 ? <p className="text-sm text-slate-500">No active IP ranges configured.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">Recently updated</h3>
            <div className="mt-4 space-y-3">
              {recent.map((device) => (
                <Link key={device.id} href={`/devices/${device.id}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-950">{device.name}</span>
                    <Badge className={statusTone[device.status]}>{statusLabels[device.status]}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-slate-600">{device.ipAddress || "No IP tracked"}</p>
                </Link>
              ))}
              {recent.length === 0 ? <p className="text-sm text-slate-500">No inventory updates yet.</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-950">Low stock</h3>
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
              {lowStockItems.length === 0 ? <p className="text-sm text-slate-500">Stock looks okay.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">Recent maintenance</h3>
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
            <h3 className="font-semibold text-slate-950">Recent stock usage</h3>
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
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h3 className="font-semibold text-slate-950">Possible conflicts</h3>
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
        </div>
      </details>
    </div>
  );
}
