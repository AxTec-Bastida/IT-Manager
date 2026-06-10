import type { PermissionAction } from "@/lib/auth";
import { assignmentResponsibleLabel, getActiveAssignmentItems } from "@/lib/assignment-views";
import { auditProgress, auditScopeLabel } from "@/lib/audits";
import { categoryLabels, stockCategoryLabels, taskCategoryLabels } from "@/lib/constants";
import { findDuplicateIps, findDuplicateMacs, summarizePhotoCompliance } from "@/lib/data-quality";
import { prisma } from "@/lib/prisma";

export const reportTypes = ["inventory", "assignments", "loans", "stock", "network", "photos", "audits", "rma", "warranty", "tasks"] as const;
export type ReportType = (typeof reportTypes)[number];

export type ReportMetric = {
  label: string;
  value: number | string;
  helper?: string;
  href?: string;
};

export type ReportRow = {
  label: string;
  value?: number | string;
  helper?: string;
  href?: string;
  actionHref?: string;
  badges?: string[];
};

export type ReportSection = {
  title: string;
  description?: string;
  rows: ReportRow[];
  emptyText?: string;
};

export type ReportData = {
  type: ReportType;
  title: string;
  description: string;
  exportHref: string;
  primaryHref: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
};

export const reportDefinitions: Record<ReportType, { title: string; shortTitle: string; description: string; primaryHref: string; permission: PermissionAction }> = {
  inventory: { title: "Inventory Report", shortTitle: "Inventory", description: "Category, status, condition, location, and lifecycle counts.", primaryHref: "/devices", permission: "inventory.read" },
  assignments: { title: "Assignment Responsibility Report", shortTitle: "Assignments", description: "Current long-term equipment responsibility by employee, team, area, and station.", primaryHref: "/assignments", permission: "inventory.read" },
  loans: { title: "Loan Report", shortTitle: "Loans", description: "Active, overdue, due-this-week, and borrower loan summaries.", primaryHref: "/loans", permission: "inventory.read" },
  stock: { title: "Stockroom Report", shortTitle: "Stockroom", description: "Low stock, out-of-stock, category, issue history, and active item loans.", primaryHref: "/stock", permission: "inventory.read" },
  network: { title: "Network / IPAM Report", shortTitle: "Network / IPAM", description: "Stored IP/MAC health for static and network-tracked assets. No network scanning.", primaryHref: "/inventory/network", permission: "inventory.read" },
  photos: { title: "Photo Compliance Report", shortTitle: "Photo Compliance", description: "Missing required photos, missing thumbnails, oversized photos, and stock photo gaps.", primaryHref: "/photos/compliance", permission: "inventory.read" },
  audits: { title: "Audit Report", shortTitle: "Audits", description: "Physical audit sessions and finding counts.", primaryHref: "/audits", permission: "audits.read" },
  rma: { title: "RMA Report", shortTitle: "RMA", description: "Active repair cases, stale follow-ups, vendor/status counts, and recently received items.", primaryHref: "/rma", permission: "inventory.read" },
  warranty: { title: "Warranty / Facturas Report", shortTitle: "Warranty / Facturas", description: "Warranty expirations, missing factura links, and warranty date gaps.", primaryHref: "/facturas", permission: "inventory.read" },
  tasks: { title: "Tasks / IT Work Report", shortTitle: "Tasks / IT Work", description: "Open work, overdue work, unassigned tasks, and category/assignee load.", primaryHref: "/tasks", permission: "tasks.read" },
};

export function isReportType(value: string): value is ReportType {
  return (reportTypes as readonly string[]).includes(value);
}

export function reportPermission(type: ReportType): PermissionAction {
  return reportDefinitions[type].permission;
}

export async function getReportsHubData(types: readonly ReportType[] = reportTypes) {
  const reports = await Promise.all(types.map(async (type) => ({ type, definition: reportDefinitions[type], preview: await getReportPreviewMetrics(type) })));
  return reports;
}

export async function getReportData(type: ReportType): Promise<ReportData> {
  if (type === "inventory") return getInventoryReport();
  if (type === "assignments") return getAssignmentsReport();
  if (type === "loans") return getLoansReport();
  if (type === "stock") return getStockReport();
  if (type === "network") return getNetworkReport();
  if (type === "photos") return getPhotosReport();
  if (type === "audits") return getAuditsReport();
  if (type === "rma") return getRmaReport();
  if (type === "warranty") return getWarrantyReport();
  return getTasksReport();
}

export async function getReportExportRows(type: ReportType) {
  const report = await getReportData(type);
  return buildReportExportRows(report);
}

export function buildReportExportRows(report: ReportData) {
  const summaryRows = report.metrics.map((metric) => ({
    report: report.title,
    section: "Summary",
    label: metric.label,
    value: metric.value,
    helper: metric.helper ?? "",
    badges: "",
    href: metric.href ?? "",
    actionHref: "",
  }));
  const sectionRows = report.sections.flatMap((section) =>
    section.rows.map((row) => ({
      report: report.title,
      section: section.title,
      label: row.label,
      value: row.value ?? "",
      helper: row.helper ?? "",
      badges: row.badges?.join("; ") ?? "",
      href: row.href ?? "",
      actionHref: row.actionHref ?? "",
    })),
  );
  return [...summaryRows, ...sectionRows];
}

export function reportTypeListMessage() {
  return reportTypes.join(", ");
}

export async function getReportPreviewMetrics(type: ReportType): Promise<ReportMetric[]> {
  const report = await getReportData(type);
  return report.metrics.slice(0, 3);
}

function baseReport(type: ReportType, metrics: ReportMetric[], sections: ReportSection[]): ReportData {
  const definition = reportDefinitions[type];
  return {
    type,
    title: definition.title,
    description: definition.description,
    exportHref: `/api/reports/${type}/export`,
    primaryHref: definition.primaryHref,
    metrics,
    sections,
  };
}

async function getInventoryReport() {
  const [total, available, assigned, loaned, rma, retiredMissing, byCategory, byStatus, byCondition, byLocation] = await Promise.all([
    prisma.device.count(),
    prisma.device.count({ where: { status: { in: ["AVAILABLE", "RESERVED"] } } }),
    prisma.device.count({ where: { status: "IN_USE_ASSIGNED" } }),
    prisma.device.count({ where: { status: "LOANED_OUT" } }),
    prisma.device.count({ where: { status: "IN_REPAIR_RMA" } }),
    prisma.device.count({ where: { status: { in: ["RETIRED", "MISSING", "LOST", "DISPOSED"] } } }),
    prisma.device.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { category: "asc" } }),
    prisma.device.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.device.groupBy({ by: ["condition"], _count: { _all: true }, orderBy: { condition: "asc" } }),
    prisma.device.groupBy({ by: ["location"], _count: { _all: true }, orderBy: { _count: { location: "desc" } }, take: 20 }),
  ]);
  return baseReport("inventory", [
    { label: "Total assets", value: total, href: "/devices?view=all" },
    { label: "Available", value: available, href: "/inventory/available" },
    { label: "Assigned", value: assigned, href: "/inventory/assigned" },
    { label: "Loaned / RMA", value: loaned + rma, href: "/inventory/loaned" },
  ], [
    { title: "Assets by category", rows: byCategory.map((item) => ({ label: categoryLabel(item.category), value: item._count._all, href: `/devices?category=${item.category}` })) },
    { title: "Assets by status", rows: byStatus.map((item) => ({ label: item.status.replaceAll("_", " "), value: item._count._all, href: `/devices?status=${item.status}` })) },
    { title: "Assets by condition", rows: byCondition.map((item) => ({ label: item.condition.replaceAll("_", " "), value: item._count._all })) },
    { title: "Top locations", rows: byLocation.map((item) => ({ label: item.location || "No location", value: item._count._all, href: `/devices?location=${encodeURIComponent(item.location || "")}` })) },
    { title: "Lifecycle views", rows: [
      { label: "Available assets", value: available, href: "/inventory/available" },
      { label: "Assigned assets", value: assigned, href: "/inventory/assigned" },
      { label: "Loaned assets", value: loaned, href: "/inventory/loaned" },
      { label: "RMA / repair assets", value: rma, href: "/inventory/rma" },
      { label: "Retired / missing / lost", value: retiredMissing, href: "/inventory/missing" },
    ] },
  ]);
}

async function getAssignmentsReport() {
  const [activeAssignments, returnedAssignments, activeItems, availableAssets] = await Promise.all([
    prisma.assignment.findMany({
      where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } },
      include: { employee: true, target: true, items: { where: { returnedAt: null }, include: { asset: true } } },
      orderBy: { assignmentDate: "desc" },
      take: 500,
    }),
    prisma.assignment.count({ where: { status: "RETURNED" } }),
    prisma.assignmentItem.count({ where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } } }),
    prisma.device.count({ where: { status: { in: ["AVAILABLE", "RESERVED"] } } }),
  ]);
  const byTarget = groupRows(activeAssignments, (assignment) => assignmentResponsibleLabel(assignment), (assignment) => getActiveAssignmentItems(assignment).length);
  const byEmployee = groupRows(activeAssignments, (assignment) => assignment.employee?.fullName ?? assignmentResponsibleLabel(assignment), (assignment) => getActiveAssignmentItems(assignment).length);
  return baseReport("assignments", [
    { label: "Active assignments", value: activeAssignments.length, href: "/assignments" },
    { label: "Active assigned assets", value: activeItems, href: "/inventory/assigned" },
    { label: "Available unassigned", value: availableAssets, href: "/inventory/available" },
    { label: "Returned history", value: returnedAssignments, href: "/assignments/history" },
  ], [
    { title: "Assigned equipment by responsibility target", rows: byTarget.map((item) => ({ label: item.label, value: item.value, href: `/assignments?q=${encodeURIComponent(item.label)}` })) },
    { title: "Assigned equipment by employee / target", rows: byEmployee.map((item) => ({ label: item.label, value: item.value, href: `/assignments?q=${encodeURIComponent(item.label)}` })) },
    { title: "Recent active assignments", rows: activeAssignments.slice(0, 15).map((assignment) => ({ label: assignmentResponsibleLabel(assignment), value: getActiveAssignmentItems(assignment).length, helper: assignment.assignmentNumber, href: `/assignments/${assignment.id}` })) },
  ]);
}

async function getLoansReport() {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const [active, overdue, dueWeek, temporary, recent, damagedLost] = await Promise.all([
    prisma.assetLoan.count({ where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } }),
    prisma.assetLoan.count({ where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE"] }, expectedReturnAt: { lt: now } } }),
    prisma.assetLoan.count({ where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE"] }, expectedReturnAt: { gte: now, lte: nextWeek } } }),
    prisma.assetLoan.count({ where: { temporaryBorrowerId: { not: null }, status: { in: ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE"] } } }),
    prisma.assetLoan.findMany({ where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED", "OVERDUE"] } }, include: { employee: true, temporaryBorrower: true, items: true }, orderBy: [{ expectedReturnAt: "asc" }], take: 20 }),
    prisma.assetLoanItem.count({ where: { returnStatus: { in: ["RETURNED_DAMAGED", "LOST", "MISSING_ACCESSORIES"] } } }),
  ]);
  return baseReport("loans", [
    { label: "Active loans", value: active, href: "/loans/active" },
    { label: "Overdue", value: overdue, href: "/loans/overdue" },
    { label: "Due this week", value: dueWeek, href: "/loans?view=due-week" },
    { label: "Temporary borrower loans", value: temporary, href: "/loans?borrower=temporary" },
  ], [
    { title: "Active and overdue loans", rows: recent.map((loan) => ({ label: loan.loanNumber, value: loan.items.filter((item) => item.returnStatus === "PENDING").length, helper: `${borrowerLabel(loan)} / due ${dateText(loan.expectedReturnAt)}`, href: `/loans/${loan.id}`, actionHref: `/tasks/new?title=${encodeURIComponent(`Review loan ${loan.loanNumber}`)}&category=INVENTORY` })) },
    { title: "Return exceptions", rows: [{ label: "Damaged/lost/missing accessory returned items", value: damagedLost, href: "/loans" }] },
  ]);
}

async function getStockReport() {
  const [activeItems, lowStock, outOfStock, byCategory, activeLoans, missingPhotos, topMovements] = await Promise.all([
    prisma.stockItem.count({ where: { active: true } }),
    prisma.stockItem.count({ where: { active: true, quantityOnHand: { lte: prisma.stockItem.fields.minimumQuantity } } }),
    prisma.stockItem.count({ where: { active: true, quantityOnHand: { lte: 0 } } }),
    prisma.stockItem.groupBy({ by: ["category"], where: { active: true }, _count: { _all: true }, orderBy: { category: "asc" } }),
    prisma.stockIssue.count({ where: { issueType: "LOAN", status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } }),
    prisma.stockItem.count({ where: { active: true, photos: { none: {} } } }),
    prisma.stockMovement.groupBy({ by: ["stockItemId"], _sum: { quantity: true }, _count: { _all: true }, orderBy: { _count: { stockItemId: "desc" } }, take: 10 }),
  ]);
  const topItems = topMovements.length ? await prisma.stockItem.findMany({ where: { id: { in: topMovements.map((item) => item.stockItemId) } }, select: { id: true, name: true } }) : [];
  return baseReport("stock", [
    { label: "Active stock items", value: activeItems, href: "/stock" },
    { label: "Low stock", value: lowStock, href: "/stock?lowOnly=true" },
    { label: "Out of stock", value: outOfStock, href: "/stock?quantity=0" },
    { label: "Active item loans", value: activeLoans, href: "/stock/issues?view=active" },
  ], [
    { title: "Stockroom by category", rows: byCategory.map((item) => ({ label: stockCategoryLabels[item.category] ?? item.category, value: item._count._all, href: `/stock?category=${item.category}` })) },
    { title: "Issue History / top movement items", rows: topMovements.map((movement) => {
      const stockItem = topItems.find((item) => item.id === movement.stockItemId);
      return { label: stockItem?.name ?? movement.stockItemId, value: movement._count._all, helper: `${movement._sum.quantity ?? 0} total movement quantity`, href: stockItem ? `/stock/${stockItem.id}` : "/stock" };
    }) },
    { title: "Photo and loan actions", rows: [
      { label: "Stock items missing photos", value: missingPhotos, href: "/stock" },
      { label: "Issue / Loan Item", value: "Open", href: "/stock/issue" },
      { label: "Issue History", value: "Open", href: "/stock/issues" },
    ] },
  ]);
}

async function getNetworkReport() {
  const devices = await prisma.device.findMany({ select: { id: true, name: true, assetTag: true, serialNumber: true, category: true, status: true, condition: true, model: true, ipAddress: true, macAddress: true, usesStaticIp: true, isFixedAsset: true, movementAlertsEnabled: true, location: true, areaDepartment: true } });
  const duplicateIps = findDuplicateIps(devices);
  const duplicateMacs = findDuplicateMacs(devices);
  const withIp = devices.filter((device) => device.ipAddress);
  const expectedNetwork = devices.filter((device) => device.usesStaticIp || device.isFixedAsset || device.movementAlertsEnabled || ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "DESKTOP", "ACCESS_POINT", "SWITCH", "CAMERA", "NVR", "CAMERA_NVR"].includes(device.category));
  const missingIp = expectedNetwork.filter((device) => !device.ipAddress);
  const missingMac = expectedNetwork.filter((device) => !device.macAddress);
  const ranges = await prisma.ipRange.findMany({ where: { active: true }, select: { id: true, name: true, startIp: true, endIp: true, vlan: true, category: true } });
  return baseReport("network", [
    { label: "Assets with IP", value: withIp.length, href: "/inventory/network" },
    { label: "Missing expected IP", value: missingIp.length, href: "/inventory/network" },
    { label: "Duplicate IPs", value: duplicateIps.length, href: "/data-quality" },
    { label: "Active ranges", value: ranges.length, href: "/ranges" },
  ], [
    { title: "Duplicate IPs", emptyText: "No duplicate active IPs.", rows: duplicateIps.map((group) => ({ label: group.ipAddress, value: group.count, helper: group.assets.map((asset) => asset.assetTag || asset.name).join("; "), href: "/data-quality" })) },
    { title: "Duplicate MACs", emptyText: "No duplicate active MACs.", rows: duplicateMacs.map((group) => ({ label: group.macAddress, value: group.count, helper: group.assets.map((asset) => asset.assetTag || asset.name).join("; "), href: "/data-quality" })) },
    { title: "Static/network assets missing IP", rows: missingIp.slice(0, 20).map((device) => assetRow(device, `/devices/${device.id}/install`)) },
    { title: "Static/network assets missing MAC", rows: missingMac.slice(0, 20).map((device) => assetRow(device, `/devices/${device.id}/install`)) },
  ]);
}

async function getPhotosReport() {
  const [devices, stockMissingPhotos] = await Promise.all([
    prisma.device.findMany({
      select: {
        id: true, name: true, assetTag: true, serialNumber: true, category: true, status: true, condition: true, brand: true, model: true, location: true, areaDepartment: true, ipAddress: true, macAddress: true, usesStaticIp: true, isFixedAsset: true, movementAlertsEnabled: true,
        photos: { select: { id: true, photoType: true, isPrimary: true, sizeBytes: true, fileSize: true, thumbnailPath: true, mimeType: true } },
        rmaItems: { select: { result: true, returnedAt: true } },
        assignmentItems: { select: { returnedAt: true } },
        assetLoanItems: { select: { returnedAt: true } },
      },
    }),
    prisma.stockItem.count({ where: { active: true, photos: { none: {} } } }),
  ]);
  const compliance = summarizePhotoCompliance(devices);
  return baseReport("photos", [
    { label: "Missing required photos", value: compliance.missingRequired.length, href: "/photos/compliance" },
    { label: "Assets with zero photos", value: compliance.assetsWithNoPhotos.length, href: "/photos/compliance" },
    { label: "Missing thumbnails", value: compliance.photosMissingThumbnails.length, href: "/photos/compliance" },
    { label: "Stock no photos", value: stockMissingPhotos, href: "/stock" },
  ], [
    { title: "Assets needing photos", rows: compliance.missingRequired.slice(0, 25).map((asset) => ({ label: asset.assetTag || asset.name, value: asset.checklist.missing.length, helper: asset.checklist.missing.join(", "), href: `/devices/${asset.id}`, actionHref: `/devices/${asset.id}#photos` })) },
    { title: "Photo maintenance", rows: [
      { label: "Missing thumbnails", value: compliance.photosMissingThumbnails.length, href: "/photos/compliance" },
      { label: "Oversized photos", value: compliance.oversizedPhotos.length, href: "/photos/compliance" },
      { label: "Stock items with no photos", value: stockMissingPhotos, href: "/stock" },
    ] },
  ]);
}

async function getAuditsReport() {
  const audits = await prisma.inventoryAuditSession.findMany({ include: { expectedItems: true, scans: true }, orderBy: { startedAt: "desc" }, take: 25 });
  const open = audits.filter((audit) => ["ACTIVE", "REVIEW"].includes(audit.status));
  const closed = audits.filter((audit) => audit.status === "CLOSED");
  const totalProgress = audits.reduce((acc, audit) => {
    const progress = auditProgress(audit.expectedItems, audit.scans);
    acc.missing += progress.missing;
    acc.wrong += progress.wrongArea;
    acc.unknown += progress.unknown;
    acc.duplicates += progress.duplicates;
    return acc;
  }, { missing: 0, wrong: 0, unknown: 0, duplicates: 0 });
  return baseReport("audits", [
    { label: "Open audits", value: open.length, href: "/audits" },
    { label: "Closed recent audits", value: closed.length, href: "/audits" },
    { label: "Missing findings", value: totalProgress.missing, href: "/audits" },
    { label: "Unknown labels", value: totalProgress.unknown, href: "/audits" },
  ], [
    { title: "Latest audit sessions", rows: audits.map((audit) => {
      const progress = auditProgress(audit.expectedItems, audit.scans);
      return { label: audit.auditNumber || audit.title, value: audit.status, helper: `${auditScopeLabel(audit)} / missing ${progress.missing} / wrong area ${progress.wrongArea}`, href: `/audits/${audit.id}`, actionHref: `/audits/${audit.id}/review` };
    }) },
    { title: "Finding counts", rows: [
      { label: "Missing", value: totalProgress.missing },
      { label: "Wrong area", value: totalProgress.wrong },
      { label: "Unknown labels", value: totalProgress.unknown },
      { label: "Duplicate scans", value: totalProgress.duplicates },
    ] },
  ]);
}

async function getRmaReport() {
  const now = new Date();
  const [active, overdue, cases, byStatus, byVendor, pendingItems, receivedItems] = await Promise.all([
    prisma.rmaCase.count({ where: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } }),
    prisma.rmaCase.count({ where: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] }, expectedFollowUpAt: { lt: now } } }),
    prisma.rmaCase.findMany({ include: { items: true }, orderBy: [{ status: "asc" }, { expectedFollowUpAt: "asc" }], take: 20 }),
    prisma.rmaCase.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.rmaCase.groupBy({ by: ["vendorName"], _count: { _all: true }, orderBy: { _count: { vendorName: "desc" } }, take: 15 }),
    prisma.rmaItem.count({ where: { result: "PENDING" } }),
    prisma.rmaItem.count({ where: { returnedAt: { not: null } } }),
  ]);
  return baseReport("rma", [
    { label: "Active RMA cases", value: active, href: "/rma/active" },
    { label: "Follow-up due", value: overdue, href: "/rma?filter=due" },
    { label: "Assets in RMA", value: pendingItems, href: "/inventory/rma" },
    { label: "Received items", value: receivedItems, href: "/rma" },
  ], [
    { title: "RMA by status", rows: byStatus.map((item) => ({ label: item.status.replaceAll("_", " "), value: item._count._all, href: `/rma?status=${item.status}` })) },
    { title: "RMA by vendor", rows: byVendor.map((item) => ({ label: item.vendorName || "No vendor", value: item._count._all })) },
    { title: "Active / recent RMA cases", rows: cases.map((rma) => ({ label: rma.rmaNumber, value: rma.status.replaceAll("_", " "), helper: `${rma.vendorName || rma.destination} / ${rma.items.length} item(s)`, href: `/rma/${rma.id}`, actionHref: `/rma/${rma.id}/receive` })) },
  ]);
}

async function getWarrantyReport() {
  const now = new Date();
  const in30 = addDays(now, 30);
  const in60 = addDays(now, 60);
  const in90 = addDays(now, 90);
  const [assets, unlinkedFacturas] = await Promise.all([
    prisma.device.findMany({ select: { id: true, name: true, assetTag: true, serialNumber: true, category: true, status: true, warrantyExpiresAt: true, facturaId: true, factura: { select: { id: true, facturaNumber: true, vendorName: true } } }, orderBy: { warrantyExpiresAt: "asc" }, take: 1000 }),
    prisma.factura.count({ where: { assets: { none: {} }, stockItems: { none: {} } } }),
  ]);
  const exp30 = assets.filter((asset) => asset.warrantyExpiresAt && asset.warrantyExpiresAt >= now && asset.warrantyExpiresAt <= in30);
  const exp60 = assets.filter((asset) => asset.warrantyExpiresAt && asset.warrantyExpiresAt >= now && asset.warrantyExpiresAt <= in60);
  const exp90 = assets.filter((asset) => asset.warrantyExpiresAt && asset.warrantyExpiresAt >= now && asset.warrantyExpiresAt <= in90);
  const expired = assets.filter((asset) => asset.warrantyExpiresAt && asset.warrantyExpiresAt < now);
  const missingFactura = assets.filter((asset) => !asset.facturaId);
  const facturaNoWarranty = assets.filter((asset) => asset.facturaId && !asset.warrantyExpiresAt);
  return baseReport("warranty", [
    { label: "Expiring 30 days", value: exp30.length },
    { label: "Expiring 90 days", value: exp90.length },
    { label: "Expired", value: expired.length },
    { label: "Unlinked facturas", value: unlinkedFacturas, href: "/data-quality" },
  ], [
    { title: "Warranty expiring soon", rows: exp90.slice(0, 25).map((asset) => ({ label: asset.assetTag || asset.name, value: dateText(asset.warrantyExpiresAt), helper: asset.factura?.facturaNumber ?? "No factura", href: `/devices/${asset.id}` })) },
    { title: "Warranty summary", rows: [
      { label: "Expiring in 30 days", value: exp30.length },
      { label: "Expiring in 60 days", value: exp60.length },
      { label: "Expiring in 90 days", value: exp90.length },
      { label: "Expired warranty", value: expired.length },
      { label: "Assets missing factura", value: missingFactura.length },
      { label: "Assets with factura but no warranty date", value: facturaNoWarranty.length },
      { label: "Unlinked facturas", value: unlinkedFacturas, href: "/data-quality" },
    ] },
  ]);
}

async function getTasksReport() {
  const now = new Date();
  const [open, unassigned, overdue, tasks, byCategory, byStatus, byAssignee] = await Promise.all([
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] } } }),
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] }, assignedToUserId: null, assignedToName: null, assignedTo: null } }),
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] }, dueDate: { lt: now } } }),
    prisma.task.findMany({ where: { status: { notIn: ["DONE", "CANCELLED"] } }, include: { assignedToUser: true, relatedAlert: true }, orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }], take: 25 }),
    prisma.task.groupBy({ by: ["category"], where: { status: { notIn: ["DONE", "CANCELLED"] } }, _count: { _all: true }, orderBy: { category: "asc" } }),
    prisma.task.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.task.groupBy({ by: ["assignedToName"], where: { status: { notIn: ["DONE", "CANCELLED"] } }, _count: { _all: true }, orderBy: { _count: { assignedToName: "desc" } }, take: 15 }),
  ]);
  const alertTasks = tasks.filter((task) => task.relatedAlertId);
  return baseReport("tasks", [
    { label: "Open tasks", value: open, href: "/tasks?view=open" },
    { label: "Unassigned", value: unassigned, href: "/tasks?view=unassigned" },
    { label: "Overdue", value: overdue, href: "/tasks?view=overdue" },
    { label: "Alert/audit sourced", value: alertTasks.length, href: "/tasks" },
  ], [
    { title: "Tasks by category", rows: byCategory.map((item) => ({ label: taskCategoryLabels[item.category] ?? item.category, value: item._count._all, href: `/tasks?category=${item.category}` })) },
    { title: "Tasks by status", rows: byStatus.map((item) => ({ label: item.status.replaceAll("_", " "), value: item._count._all, href: `/tasks?status=${item.status}` })) },
    { title: "Tasks by assignee", rows: byAssignee.map((item) => ({ label: item.assignedToName || "Unassigned", value: item._count._all, href: `/tasks?q=${encodeURIComponent(item.assignedToName || "Unassigned")}` })) },
    { title: "Open work", rows: tasks.map((task) => ({ label: task.title, value: task.priority, helper: `${task.category.replaceAll("_", " ")} / due ${dateText(task.dueDate) || "not set"}`, href: `/tasks/${task.id}` })) },
  ]);
}

function groupRows<T>(items: T[], labelFor: (item: T) => string, valueFor: (item: T) => number) {
  const groups = new Map<string, number>();
  for (const item of items) {
    const label = labelFor(item) || "Unknown";
    groups.set(label, (groups.get(label) ?? 0) + valueFor(item));
  }
  return [...groups.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, 25);
}

function assetRow(device: { id: string; name: string; assetTag?: string | null; category: string; location?: string | null; areaDepartment?: string | null }, actionHref?: string): ReportRow {
  return {
    label: device.assetTag || device.name,
    value: categoryLabel(device.category),
    helper: [device.name, device.areaDepartment, device.location].filter(Boolean).join(" / "),
    href: `/devices/${device.id}`,
    actionHref,
  };
}

function borrowerLabel(loan: { employee?: { fullName: string } | null; temporaryBorrower?: { name: string } | null }) {
  return loan.employee?.fullName || loan.temporaryBorrower?.name || "Unknown borrower";
}

function categoryLabel(category: string) {
  return categoryLabels[category as keyof typeof categoryLabels] ?? category.replaceAll("_", " ");
}

function dateText(value?: Date | string | null) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
