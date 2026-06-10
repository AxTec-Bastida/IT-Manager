import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { getCurrentUser } from "@/lib/auth";
import { appUserCanReceiveTasks, buildTaskContextRecords, suggestedTaskCategoryFromSource } from "@/lib/tasks";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export default async function NewTaskPage({ searchParams }: Props) {
  if (!(await hasPagePermission("tasks.write"))) return <ForbiddenPanel message="Creating tasks requires IT Staff, Auditor, or Admin access." />;
  const params = await searchParams;
  const sourceType = param(params, "sourceType");
  const sourceId = param(params, "sourceId");
  const deviceId = param(params, "deviceId") || param(params, "relatedDeviceId") || (sourceType === "device" || sourceType === "asset" ? sourceId : "");
  const employeeId = param(params, "employeeId") || param(params, "relatedEmployeeId") || (sourceType === "employee" ? sourceId : "");
  const stockItemId = param(params, "stockItemId") || param(params, "relatedStockItemId") || (sourceType === "stock" || sourceType === "stockItem" ? sourceId : "");
  const facturaId = param(params, "facturaId") || param(params, "relatedFacturaId") || (sourceType === "factura" ? sourceId : "");
  const alertId = param(params, "alertId") || param(params, "relatedAlertId") || (sourceType === "alert" ? sourceId : "");
  const auditId = param(params, "auditId") || (sourceType === "audit" ? sourceId : "");
  const rmaId = param(params, "rmaId") || (sourceType === "rma" ? sourceId : "");

  const [currentUser, assignees, device, employee, stockItem, factura, alert] = await Promise.all([
    getCurrentUser(),
    prisma.appUser.findMany({ where: { isActive: true, role: { in: ["ADMIN", "IT_STAFF", "AUDITOR"] } }, select: { id: true, name: true, email: true, role: true, isActive: true }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    deviceId ? prisma.device.findUnique({ where: { id: deviceId }, select: { id: true, name: true, assetTag: true } }) : null,
    employeeId ? prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, fullName: true, employeeId: true } }) : null,
    stockItemId ? prisma.stockItem.findUnique({ where: { id: stockItemId }, select: { id: true, name: true, sku: true } }) : null,
    facturaId ? prisma.factura.findUnique({ where: { id: facturaId }, select: { id: true, facturaNumber: true, vendorName: true } }) : null,
    alertId ? prisma.alert.findUnique({ where: { id: alertId }, select: { id: true, title: true, type: true, assetId: true } }) : null,
  ]);

  const contextRecords = buildTaskContextRecords({ device, employee, stockItem, factura, alert, auditId, rmaId });
  const suggestedCategory = suggestedTaskCategoryFromSource({ sourceType, alertType: alert?.type, deviceId, stockItemId, auditId, rmaId });
  const suggestedNotes = param(params, "notes") || (auditId ? `Audit finding source: ${auditId}` : rmaId ? `RMA source: ${rmaId}` : undefined);

  return (
    <div className="space-y-6">
      <PageHeader title="New task" description="Capture a focused IT follow-up with source context instead of a generic database form." />
      <TaskForm
        assignees={assignees.filter(appUserCanReceiveTasks)}
        currentUserId={currentUser?.id}
        contextRecords={contextRecords}
        hiddenRelations={{ relatedDeviceId: deviceId || alert?.assetId, relatedEmployeeId: employeeId, relatedStockItemId: stockItemId, relatedFacturaId: facturaId, relatedAlertId: alertId }}
        suggestedCategory={suggestedCategory}
        suggestedNotes={suggestedNotes}
      />
    </div>
  );
}
