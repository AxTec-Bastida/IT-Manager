import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, BriefcaseBusiness, ClipboardCheck, ClipboardList, Database, ExternalLink, FileSpreadsheet, ListChecks, Network, Package, PackageCheck, Plus, ReceiptText, ScanLine, SearchX, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { categoryLabels, severityTone, statusLabels, statusTone } from "@/lib/constants";
import { detectInventoryConflicts } from "@/lib/conflicts";
import { localeCookieName, normalizeLocale } from "@/lib/i18n";
import { isIpInRange, rangeSize, validateIpRange } from "@/lib/ip";
import { buildPrinterAlertCandidates } from "@/lib/maintenance-alerts";

export const dynamic = "force-dynamic";

const dashboardText = {
  en: {
    title: "Dashboard",
    description: "Start with the daily warehouse IT workflow, then drill into the details only when you need them.",
    quickScan: "Quick Scan",
    addAsset: "Add Asset",
    startHere: "Start here",
    whatToday: "What do you want to do today?",
    dailyActions: {
      scan: ["Scan an asset", "Scan, check status, take action."],
      search: ["Search inventory", "Find devices, owners, locations."],
      add: ["Add asset", "Create a new inventory record."],
      assign: ["Assign equipment", "Start or review assignments."],
      loan: ["Loan serialized asset", "Temporary checkout for devices."],
      stock: ["Use stock", "Check, add, or hand out items."],
      rma: ["RMA / repair", "Create or receive repair batches."],
      alerts: ["Review alerts", "No open alerts."],
      import: ["Import inventory", "Preview a legacy workbook import."],
      tools: ["Open IT tools", "Jump to common portals and docs."],
    },
    activeAssetLoan: (count: number) => `${count} active asset loan${count === 1 ? "" : "s"}.`,
    activeStockLoan: (count: number) => `${count} active stock loan${count === 1 ? "" : "s"}.`,
    activeRma: (count: number) => `${count} active repair batch${count === 1 ? "" : "es"}.`,
    openAlerts: (count: number) => `${count} open alert${count === 1 ? "" : "s"}.`,
    needsAttention: "Needs Attention",
    attentionDescription: "Only the daily signals that usually need action.",
    reviewAlertCenter: "Review alert center",
    review: "Review",
    healthy: "Healthy",
    noOpenAlerts: "No open alerts",
    labels: {
      openAlerts: "Open Alerts",
      maintenanceDue: "Maintenance Due",
      lowStock: "Low Stock",
      missingAssets: "Missing Assets",
      tasksDue: "Tasks Due",
      totalAssets: "Total Assets",
      available: "Available",
      assigned: "Assigned",
      inRepair: "In Repair/RMA",
      missing: "Missing",
      openTasks: "Open Tasks",
      dueToday: "Due Today",
      poFollowUps: "PO Follow-ups",
      awaitingFactura: "Awaiting Factura",
      favoriteTools: "Favorite Tools",
      stockLoans: "Stock Loans",
      assetLoans: "Asset Loans",
      activeRmas: "Active RMAs",
      rmaFollowUps: "RMA Follow-ups",
      usedIps: "Used IPs",
      availableIps: "Available IPs",
      possibleConflicts: "Possible conflicts",
      manualLocationUpdates: "Manual location updates",
      notSeenRecently: "Not seen recently",
      thermalCleaningDue: "Thermal cleaning due",
      mfpSuppliesLow: "MFP supplies low",
      activeAssignments: "Active assignments",
    },
    helpers: {
      needsReview: "Needs review",
      printerWorkDue: "Printer or device work due",
      maintenanceClear: "Maintenance is clear",
      itemsAtMinimum: "Items at or below minimum",
      stockOkay: "Stock looks okay",
      checkMap: "Check map and recent sightings",
      noMissingAssets: "No missing assets",
      dueToday: "Due today",
      noTasksDue: "No tasks due today",
      allInventory: "All inventory records",
      readyToAssign: "Ready to assign",
      noAvailableAssets: "No available assets",
      currentlyInUse: "Currently in use",
      noAssignedAssets: "No assigned assets",
      needsFollowUp: "Needs follow-up",
      noRepairQueue: "No repair queue",
      needsLocationReview: "Needs location review",
      nothingMissing: "Nothing marked missing",
      activeFollowUps: "Active follow-ups",
      noOpenTasks: "No open tasks",
      dueBeforeEnd: "Due before end of day",
      vendorFollowUp: "Vendor or purchase follow-up",
      noPoDue: "No PO follow-ups due",
      waitingInvoice: "Waiting on invoice records",
      noPendingFacturas: "No pending facturas",
      pinnedResources: "Pinned resources ready",
      noFavorites: "No favorites yet",
      activeStockLoans: "Active stock loans",
      activeSerializedCheckouts: "Active serialized checkouts",
      devicesInRepair: (count: number) => `${count} devices in repair`,
      noActiveRepairBatches: "No active repair batches",
      rmaFollowUpDue: "Follow up due",
      noRmaFollowUps: "No RMA follow-ups due",
      overdue: (count: number) => `${count} overdue`,
    },
    inventorySnapshot: "Inventory Snapshot",
    inventorySnapshotDescription: "A quick read on asset availability and exceptions.",
    workspaceSnapshot: "Workspace Snapshot",
    workspaceSnapshotDescription: "Lightweight tasks, purchase follow-ups, and quick links.",
    openWorkspace: "Open workspace",
    secondaryMetrics: "Secondary Metrics",
    secondaryHint: "Advanced inventory, IPAM, and recent activity",
    categories: "Categories",
    rangeSummary: "VLAN/range summary",
    usedAvailable: (used: number, capacity: number) => `${used}/${capacity} used, ${Math.max(capacity - used, 0)} available`,
    noRanges: "No active IP ranges configured.",
    recentlyUpdated: "Recently updated",
    noIpTracked: "No IP tracked",
    noInventoryUpdates: "No inventory updates yet.",
    lowStock: "Low stock",
    view: "View",
    noLocation: "No location",
    recentMaintenance: "Recent maintenance",
    noMaintenance: "No maintenance records yet.",
    recentStockUsage: "Recent stock usage",
    noStockMovement: "No stock movement history yet.",
    possibleConflicts: "Possible conflicts",
    viewAll: "View all",
    noConflicts: "No active conflicts detected.",
  },
  es: {
    title: "Inicio",
    description: "Empieza con el flujo diario de IT del almacén y entra al detalle solo cuando lo necesites.",
    quickScan: "Escanear",
    addAsset: "Agregar activo",
    startHere: "Empieza aquí",
    whatToday: "¿Qué quieres hacer hoy?",
    dailyActions: {
      scan: ["Escanear activo", "Escanea, revisa estado y toma acción."],
      search: ["Buscar inventario", "Encuentra equipos, responsables y ubicaciones."],
      add: ["Agregar activo", "Crea un nuevo registro de inventario."],
      assign: ["Asignar equipo", "Inicia o revisa asignaciones."],
      loan: ["Prestar equipo serializado", "Checkout temporal de dispositivos."],
      stock: ["Usar stock", "Revisa, agrega o entrega artículos."],
      rma: ["RMA / reparación", "Crea o recibe lotes de reparación."],
      alerts: ["Revisar alertas", "No hay alertas abiertas."],
      import: ["Importar inventario", "Previsualiza importación legacy."],
      tools: ["Abrir recursos IT", "Accesos a portales y documentos."],
    },
    activeAssetLoan: (count: number) => `${count} préstamo${count === 1 ? "" : "s"} de activo activo${count === 1 ? "" : "s"}.`,
    activeStockLoan: (count: number) => `${count} préstamo${count === 1 ? "" : "s"} de stock activo${count === 1 ? "" : "s"}.`,
    activeRma: (count: number) => `${count} lote${count === 1 ? "" : "s"} de reparación activo${count === 1 ? "" : "s"}.`,
    openAlerts: (count: number) => `${count} alerta${count === 1 ? "" : "s"} abierta${count === 1 ? "" : "s"}.`,
    needsAttention: "Necesita atención",
    attentionDescription: "Solo señales diarias que normalmente requieren acción.",
    reviewAlertCenter: "Revisar centro de alertas",
    review: "Revisar",
    healthy: "Bien",
    noOpenAlerts: "Sin alertas abiertas",
    labels: {
      openAlerts: "Alertas abiertas",
      maintenanceDue: "Mantenimiento pendiente",
      lowStock: "Stock bajo",
      missingAssets: "Activos faltantes",
      tasksDue: "Tareas vencidas",
      totalAssets: "Total de activos",
      available: "Disponibles",
      assigned: "Asignados",
      inRepair: "En reparación/RMA",
      missing: "Faltantes",
      openTasks: "Tareas abiertas",
      dueToday: "Para hoy",
      poFollowUps: "Seguimiento PO",
      awaitingFactura: "Esperando factura",
      favoriteTools: "Recursos favoritos",
      stockLoans: "Préstamos de stock",
      assetLoans: "Préstamos de activos",
      activeRmas: "RMAs activos",
      rmaFollowUps: "Seguimiento RMA",
      usedIps: "IPs usadas",
      availableIps: "IPs disponibles",
      possibleConflicts: "Posibles conflictos",
      manualLocationUpdates: "Ubicaciones manuales",
      notSeenRecently: "No visto recientemente",
      thermalCleaningDue: "Limpieza térmica pendiente",
      mfpSuppliesLow: "Supplies MFP bajos",
      activeAssignments: "Asignaciones activas",
    },
    helpers: {
      needsReview: "Requiere revisión",
      printerWorkDue: "Trabajo de impresora o equipo pendiente",
      maintenanceClear: "Mantenimiento al día",
      itemsAtMinimum: "Artículos en mínimo o menos",
      stockOkay: "Stock se ve bien",
      checkMap: "Revisa mapa y avistamientos recientes",
      noMissingAssets: "Sin activos faltantes",
      dueToday: "Vence hoy",
      noTasksDue: "Sin tareas para hoy",
      allInventory: "Todos los registros",
      readyToAssign: "Listos para asignar",
      noAvailableAssets: "Sin activos disponibles",
      currentlyInUse: "Actualmente en uso",
      noAssignedAssets: "Sin activos asignados",
      needsFollowUp: "Requiere seguimiento",
      noRepairQueue: "Sin cola de reparación",
      needsLocationReview: "Requiere revisar ubicación",
      nothingMissing: "Nada marcado faltante",
      activeFollowUps: "Seguimientos activos",
      noOpenTasks: "Sin tareas abiertas",
      dueBeforeEnd: "Vence antes de terminar el día",
      vendorFollowUp: "Seguimiento de vendor o compra",
      noPoDue: "Sin seguimientos PO pendientes",
      waitingInvoice: "Esperando registros de factura",
      noPendingFacturas: "Sin facturas pendientes",
      pinnedResources: "Recursos fijados listos",
      noFavorites: "Sin favoritos todavía",
      activeStockLoans: "Préstamos de stock activos",
      activeSerializedCheckouts: "Checkouts serializados activos",
      devicesInRepair: (count: number) => `${count} dispositivos en reparación`,
      noActiveRepairBatches: "Sin lotes de reparación activos",
      rmaFollowUpDue: "Seguimiento pendiente",
      noRmaFollowUps: "Sin seguimientos RMA pendientes",
      overdue: (count: number) => `${count} vencida${count === 1 ? "" : "s"}`,
    },
    inventorySnapshot: "Resumen de inventario",
    inventorySnapshotDescription: "Lectura rápida de disponibilidad y excepciones.",
    workspaceSnapshot: "Resumen de trabajo",
    workspaceSnapshotDescription: "Tareas, seguimiento de compras y accesos rápidos.",
    openWorkspace: "Abrir trabajo",
    secondaryMetrics: "Métricas secundarias",
    secondaryHint: "Inventario avanzado, IPAM y actividad reciente",
    categories: "Categorías",
    rangeSummary: "Resumen VLAN/rangos",
    usedAvailable: (used: number, capacity: number) => `${used}/${capacity} usadas, ${Math.max(capacity - used, 0)} disponibles`,
    noRanges: "No hay rangos IP activos configurados.",
    recentlyUpdated: "Actualizados recientemente",
    noIpTracked: "Sin IP registrada",
    noInventoryUpdates: "Sin actualizaciones de inventario.",
    lowStock: "Stock bajo",
    view: "Ver",
    noLocation: "Sin ubicación",
    recentMaintenance: "Mantenimiento reciente",
    noMaintenance: "Sin registros de mantenimiento.",
    recentStockUsage: "Uso reciente de stock",
    noStockMovement: "Sin historial de movimientos de stock.",
    possibleConflicts: "Posibles conflictos",
    viewAll: "Ver todo",
    noConflicts: "No hay conflictos activos detectados.",
  },
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value);
  const t = dashboardText[locale];
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
    { title: t.dailyActions.scan[0], helper: t.dailyActions.scan[1], href: "/scan", icon: ScanLine, primary: true },
    { title: t.dailyActions.search[0], helper: t.dailyActions.search[1], href: "/devices", icon: Database },
    { title: t.dailyActions.add[0], helper: t.dailyActions.add[1], href: "/intake/assets/new", icon: Plus },
    { title: t.dailyActions.assign[0], helper: t.dailyActions.assign[1], href: "/assignments", icon: ClipboardCheck },
    { title: t.dailyActions.loan[0], helper: activeAssetLoans ? t.activeAssetLoan(activeAssetLoans) : t.dailyActions.loan[1], href: "/loans/quick-checkout", icon: ClipboardList },
    { title: t.dailyActions.stock[0], helper: activeStockLoans ? t.activeStockLoan(activeStockLoans) : t.dailyActions.stock[1], href: "/stock/issue", icon: Package },
    { title: t.dailyActions.rma[0], helper: activeRmas ? t.activeRma(activeRmas) : t.dailyActions.rma[1], href: "/rma", icon: PackageCheck },
    { title: t.dailyActions.alerts[0], helper: openAlerts ? t.openAlerts(openAlerts) : t.dailyActions.alerts[1], href: "/alerts", icon: AlertTriangle },
    { title: t.dailyActions.import[0], helper: t.dailyActions.import[1], href: "/import/legacy-sheet", icon: FileSpreadsheet },
    { title: t.dailyActions.tools[0], helper: t.dailyActions.tools[1], href: "/tools", icon: ExternalLink },
  ];

  const attentionCards = [
    { kind: "warning" as const, label: t.labels.openAlerts, value: openAlerts, helper: openAlerts ? t.helpers.needsReview : t.noOpenAlerts, icon: AlertTriangle, href: "/alerts", tone: openAlerts ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { kind: "warning" as const, label: t.labels.maintenanceDue, value: maintenanceDue, helper: maintenanceDue ? t.helpers.printerWorkDue : t.helpers.maintenanceClear, icon: Wrench, href: "/alerts?source=PRINTER", tone: maintenanceDue ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { kind: "warning" as const, label: t.labels.lowStock, value: lowStockItems.length, helper: lowStockItems.length ? t.helpers.itemsAtMinimum : t.helpers.stockOkay, icon: Package, href: "/stock?lowOnly=true", tone: lowStockItems.length ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { kind: "danger" as const, label: t.labels.missingAssets, value: missingAssets, helper: missingAssets ? t.helpers.checkMap : t.helpers.noMissingAssets, icon: SearchX, href: "/missing", tone: missingAssets ? "border-rose-200/70 bg-rose-50/30 hover:border-rose-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
    { kind: overdueTasks ? ("danger" as const) : ("warning" as const), label: t.labels.tasksDue, value: overdueTasks + tasksDueToday, helper: overdueTasks ? t.helpers.overdue(overdueTasks) : tasksDueToday ? t.helpers.dueToday : t.helpers.noTasksDue, icon: ListChecks, href: overdueTasks ? "/tasks?overdue=true" : "/tasks?dueToday=true", tone: overdueTasks ? "border-rose-200/70 bg-rose-50/30 hover:border-rose-400/70" : tasksDueToday ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-400/70" : "border-slate-200 bg-white hover:border-emerald-500/30" },
  ];

  const inventoryCards = [
    { label: t.labels.totalAssets, value: devices.length, helper: t.helpers.allInventory, icon: Database, href: "/devices" },
    { label: t.labels.available, value: availableAssets, helper: availableAssets ? t.helpers.readyToAssign : t.helpers.noAvailableAssets, icon: Database, href: "/devices?status=AVAILABLE" },
    { label: t.labels.assigned, value: assignedAssets, helper: assignedAssets ? t.helpers.currentlyInUse : t.helpers.noAssignedAssets, icon: ClipboardCheck, href: "/devices?status=IN_USE_ASSIGNED" },
    { label: t.labels.inRepair, value: repairAssets, helper: repairAssets ? t.helpers.needsFollowUp : t.helpers.noRepairQueue, icon: Wrench, href: "/devices?status=IN_REPAIR_RMA" },
    { label: t.labels.missing, value: missingAssets, helper: missingAssets ? t.helpers.needsLocationReview : t.helpers.nothingMissing, icon: SearchX, href: "/missing" },
  ];

  const workspaceCards = [
    { label: t.labels.openTasks, value: openTasks, helper: openTasks ? t.helpers.activeFollowUps : t.helpers.noOpenTasks, href: "/tasks", icon: ListChecks },
    { label: t.labels.dueToday, value: tasksDueToday, helper: tasksDueToday ? t.helpers.dueBeforeEnd : t.helpers.noTasksDue, href: "/tasks?dueToday=true", icon: ClipboardCheck },
    { label: t.labels.poFollowUps, value: poFollowUpsDue, helper: poFollowUpsDue ? t.helpers.vendorFollowUp : t.helpers.noPoDue, href: "/po-tracker?followUpDue=true", icon: ReceiptText },
    { label: t.labels.awaitingFactura, value: posAwaitingFactura, helper: posAwaitingFactura ? t.helpers.waitingInvoice : t.helpers.noPendingFacturas, href: "/po-tracker?facturaPending=true", icon: FileSpreadsheet },
    { label: t.labels.favoriteTools, value: favoriteTools.length, helper: favoriteTools.length ? t.helpers.pinnedResources : t.helpers.noFavorites, href: "/tools", icon: ExternalLink },
    { label: t.labels.stockLoans, value: activeStockLoans, helper: overdueStockLoans ? t.helpers.overdue(overdueStockLoans) : t.helpers.activeStockLoans, href: overdueStockLoans ? "/stock/issues?view=overdue" : "/stock/issues?view=active", icon: Package },
    { label: t.labels.assetLoans, value: activeAssetLoans, helper: overdueAssetLoans ? t.helpers.overdue(overdueAssetLoans) : t.helpers.activeSerializedCheckouts, href: overdueAssetLoans ? "/loans?view=overdue" : "/loans?view=active", icon: ClipboardList },
    { label: t.labels.activeRmas, value: activeRmas, helper: activeRmas ? t.helpers.devicesInRepair(devicesInRma) : t.helpers.noActiveRepairBatches, href: "/rma", icon: PackageCheck },
    { label: t.labels.rmaFollowUps, value: rmaFollowUpsDue, helper: rmaFollowUpsDue ? t.helpers.rmaFollowUpDue : t.helpers.noRmaFollowUps, href: "/rma?followUpDue=true", icon: AlertTriangle },
  ];

  const secondaryCards = [
    { label: t.labels.usedIps, value: usedDevices.length, icon: Network },
    { label: t.labels.availableIps, value: Math.max(totalCapacity - usedInPools, 0), icon: Network },
    { label: t.labels.possibleConflicts, value: conflicts.length, icon: AlertTriangle },
    { label: t.labels.manualLocationUpdates, value: recentLocationCount, icon: Network },
    { label: t.labels.notSeenRecently, value: devices.filter((device) => !device.lastSeenAt || device.lastSeenAt < sevenDaysAgo).length, icon: Database },
    { label: t.labels.thermalCleaningDue, value: thermalCleaningDue, icon: Wrench },
    { label: t.labels.mfpSuppliesLow, value: mfpSuppliesLow, icon: Package },
    { label: t.labels.activeAssignments, value: activeAssignments, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <div className="grid gap-2 sm:flex">
            <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 sm:min-h-12 sm:text-sm" href="/scan">
              <ScanLine size={16} />
              {t.quickScan}
            </Link>
            <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-100 sm:min-h-12 sm:text-sm" href="/intake/assets/new">
              <Plus size={16} />
              {t.addAsset}
            </Link>
          </div>
        }
      />

      <section className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.startHere}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{t.whatToday}</h2>
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
            <h2 className="text-lg font-semibold text-slate-950">{t.needsAttention}</h2>
            <p className="text-sm text-slate-500">{t.attentionDescription}</p>
          </div>
          <Link href="/alerts" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 hover:text-slate-950">
            {t.reviewAlertCenter}
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
                    <Badge tone={needsAction ? card.kind : "success"}>
                      {needsAction ? t.review : t.healthy}
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
          <h2 className="text-lg font-semibold text-slate-950">{t.inventorySnapshot}</h2>
          <p className="text-sm text-slate-500">{t.inventorySnapshotDescription}</p>
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
            <h2 className="text-lg font-semibold text-slate-950">{t.workspaceSnapshot}</h2>
            <p className="text-sm text-slate-500">{t.workspaceSnapshotDescription}</p>
          </div>
          <Link href="/workspace" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950">
            <BriefcaseBusiness size={16} />
            {t.openWorkspace}
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
          <span>{t.secondaryMetrics}</span>
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">{t.secondaryHint}</span>
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
            <h3 className="font-semibold text-slate-950">{t.categories}</h3>
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
            <h3 className="font-semibold text-slate-950">{t.rangeSummary}</h3>
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
                      {t.usedAvailable(used, capacity)}
                    </p>
                  </div>
                );
              })}
              {ranges.length === 0 ? <p className="text-sm text-slate-500">{t.noRanges}</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">{t.recentlyUpdated}</h3>
            <div className="mt-4 space-y-3">
              {recent.map((device) => (
                <Link key={device.id} href={`/devices/${device.id}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-950">{device.name}</span>
                    <Badge className={statusTone[device.status]}>{statusLabels[device.status]}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-slate-600">{device.ipAddress || t.noIpTracked}</p>
                </Link>
              ))}
              {recent.length === 0 ? <p className="text-sm text-slate-500">{t.noInventoryUpdates}</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-950">{t.lowStock}</h3>
              <Link href="/stock?lowOnly=true" className="text-sm font-semibold text-slate-700 hover:text-slate-950">{t.view}</Link>
            </div>
            <div className="mt-3 space-y-2">
              {lowStockItems.slice(0, 5).map((item) => (
                <Link key={item.id} href={`/stock/${item.id}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-950">{item.name}</span>
                    <Badge className="bg-rose-100 text-rose-800 ring-rose-200">{item.quantityOnHand}/{item.minimumQuantity}</Badge>
                  </div>
                  <p className="text-slate-500">{item.storageLocation || t.noLocation}</p>
                </Link>
              ))}
              {lowStockItems.length === 0 ? <p className="text-sm text-slate-500">{t.helpers.stockOkay}</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">{t.recentMaintenance}</h3>
            <div className="mt-3 space-y-2">
              {recentMaintenance.map((record) => (
                <Link key={record.id} href={`/devices/${record.assetId}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                  <p className="font-medium text-slate-950">{record.asset.name}</p>
                  <p className="text-slate-500">{record.maintenanceType.replaceAll("_", " ")} - {record.performedAt.toLocaleString()}</p>
                </Link>
              ))}
              {recentMaintenance.length === 0 ? <p className="text-sm text-slate-500">{t.noMaintenance}</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-950">{t.recentStockUsage}</h3>
            <div className="mt-3 space-y-2">
              {recentStockUsage.map((movement) => (
                <Link key={movement.id} href={`/stock/${movement.stockItemId}`} className="block rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
                  <p className="font-medium text-slate-950">{movement.stockItem.name}</p>
                  <p className="text-slate-500">{movement.movementType.replaceAll("_", " ")} - {movement.previousQuantity} to {movement.newQuantity}</p>
                </Link>
              ))}
              {recentStockUsage.length === 0 ? <p className="text-sm text-slate-500">{t.noStockMovement}</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h3 className="font-semibold text-slate-950">{t.possibleConflicts}</h3>
            <Link href="/conflicts" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
              {t.viewAll}
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
            {conflicts.length === 0 ? <p className="p-4 text-sm text-slate-500">{t.noConflicts}</p> : null}
          </div>
        </div>
      </details>
    </div>
  );
}
