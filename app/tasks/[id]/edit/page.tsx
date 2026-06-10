import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "@/components/task-form";
import { getCurrentUser } from "@/lib/auth";
import { appUserCanReceiveTasks, buildTaskContextRecords, cleanTaskCategory } from "@/lib/tasks";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditTaskPage({ params }: Props) {
  if (!(await hasPagePermission("tasks.write"))) return <ForbiddenPanel message="Editing tasks requires IT Staff, Auditor, or Admin access." />;
  const { id } = await params;
  const [task, assignees, currentUser] = await Promise.all([
    prisma.task.findUnique({ where: { id }, include: { assignedToUser: true, relatedDevice: true, relatedEmployee: true, relatedStockItem: true, relatedFactura: true, relatedAlert: true } }),
    prisma.appUser.findMany({ where: { isActive: true, role: { in: ["ADMIN", "IT_STAFF", "AUDITOR"] } }, select: { id: true, name: true, email: true, role: true, isActive: true }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    getCurrentUser(),
  ]);
  if (!task) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit task" description={task.title} />
      <TaskForm
        task={{ ...task, category: cleanTaskCategory(task.category) }}
        assignees={assignees.filter(appUserCanReceiveTasks)}
        currentUserId={currentUser?.id}
        contextRecords={buildTaskContextRecords({ device: task.relatedDevice, employee: task.relatedEmployee, stockItem: task.relatedStockItem, factura: task.relatedFactura, alert: task.relatedAlert })}
        hiddenRelations={{
          relatedDeviceId: task.relatedDeviceId,
          relatedEmployeeId: task.relatedEmployeeId,
          relatedStockItemId: task.relatedStockItemId,
          relatedFacturaId: task.relatedFacturaId,
          relatedAlertId: task.relatedAlertId,
        }}
      />
    </div>
  );
}
