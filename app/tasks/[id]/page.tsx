import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { WorkspaceStatusButton } from "@/components/workspace-status-button";
import { TaskAssignButton } from "@/components/task-assign-button";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { taskCategoryLabels, taskPriorityLabels, taskPriorityTone, taskStatusLabels, taskStatusTone } from "@/lib/constants";
import { taskAssigneeLabel } from "@/lib/tasks";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TaskDetailPage({ params }: Props) {
  if (!(await hasPagePermission("tasks.read"))) return <ForbiddenPanel message="Task details require IT Staff, Auditor, or Admin access." />;
  const { id } = await params;
  const [task, activity] = await Promise.all([
    prisma.task.findUnique({ where: { id }, include: { assignedToUser: true, relatedDevice: true, relatedEmployee: true, relatedStockItem: true, relatedFactura: true, relatedAlert: true } }),
    prisma.activityLog.findMany({ where: { entity: "task", entityId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  if (!task) notFound();

  const relatedLinks = [
    task.relatedDevice ? { label: `Asset: ${task.relatedDevice.name}`, href: `/devices/${task.relatedDeviceId}` } : null,
    task.relatedEmployee ? { label: `Employee: ${task.relatedEmployee.fullName}`, href: `/employees/${task.relatedEmployeeId}` } : null,
    task.relatedStockItem ? { label: `Stock: ${task.relatedStockItem.name}`, href: `/stock/${task.relatedStockItemId}` } : null,
    task.relatedFactura ? { label: `Factura: ${task.relatedFactura.facturaNumber}`, href: `/facturas/${task.relatedFacturaId}` } : null,
    task.relatedAlert ? { label: `Alert: ${task.relatedAlert.title}`, href: `/alerts?assetId=${task.relatedAlert.assetId ?? ""}` } : null,
  ].filter((value): value is { label: string; href: string } => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description={task.description || "Quick IT follow-up"}
        action={<Link href={`/tasks/${task.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Edit size={16} />Edit</Link>}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={taskStatusTone[task.status]}>{taskStatusLabels[task.status]}</Badge>
          <Badge className={taskPriorityTone[task.priority]}>{taskPriorityLabels[task.priority]}</Badge>
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{taskCategoryLabels[task.category]}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["Due date", task.dueDate ? task.dueDate.toLocaleDateString() : "-"],
            ["Reminder", task.reminderDate ? task.reminderDate.toLocaleDateString() : "-"],
            ["Assigned to", taskAssigneeLabel(task)],
            ["Completed", task.completedAt ? task.completedAt.toLocaleString() : "-"],
            ["Created", task.createdAt.toLocaleString()],
            ["Updated", task.updatedAt.toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd>
            </div>
          ))}
        </dl>
        {task.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{task.notes}</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Actions</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {!task.assignedToUserId ? <TaskAssignButton taskId={task.id} /> : null}
          <WorkspaceStatusButton endpoint={`/api/tasks/${task.id}`} status="IN_PROGRESS">In progress</WorkspaceStatusButton>
          <WorkspaceStatusButton endpoint={`/api/tasks/${task.id}`} status="WAITING">Waiting</WorkspaceStatusButton>
          <WorkspaceStatusButton endpoint={`/api/tasks/${task.id}`} status="DONE" variant="primary">Done</WorkspaceStatusButton>
          <WorkspaceStatusButton endpoint={`/api/tasks/${task.id}`} status="CANCELLED">Cancel</WorkspaceStatusButton>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Related records</h2>
        <div className="mt-3 grid gap-2">
          {relatedLinks.map((link) => <Link key={link.href} href={link.href} className="inline-flex min-h-12 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">{link.label}</Link>)}
          {relatedLinks.length === 0 ? <p className="text-sm text-slate-500">No related records linked.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Activity</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {activity.map((item) => <div key={item.id} className="py-3 text-sm"><p className="font-medium text-slate-950">{item.message}</p><p className="text-slate-500">{item.createdAt.toLocaleString()}</p></div>)}
          {activity.length === 0 ? <p className="text-sm text-slate-500">No task activity yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
