import Link from "next/link";
import { CheckCircle2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { WorkspaceStatusButton } from "@/components/workspace-status-button";
import { taskCategoryLabels, taskCategoryOptions, taskPriorityLabels, taskPriorityOptions, taskPriorityTone, taskStatusLabels, taskStatusOptions, taskStatusTone } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TasksPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const priority = typeof params.priority === "string" ? params.priority : "";
  const category = typeof params.category === "string" ? params.category : "";
  const assignedTo = typeof params.assignedTo === "string" ? params.assignedTo.trim() : "";
  const dueToday = params.dueToday === "true";
  const overdue = params.overdue === "true";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tasks = await prisma.task.findMany({
    where: {
      ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }, { notes: { contains: q } }] } : {}),
      ...(status ? { status: status as never } : {}),
      ...(priority ? { priority: priority as never } : {}),
      ...(category ? { category: category as never } : {}),
      ...(assignedTo ? { assignedTo: { contains: assignedTo } } : {}),
      ...(dueToday ? { dueDate: { gte: today, lt: tomorrow }, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
      ...(overdue ? { dueDate: { lt: today }, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
    },
    include: { relatedDevice: true, relatedStockItem: true, relatedFactura: true, relatedAlert: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
  });

  const activeFilters = [
    status ? taskStatusLabels[status as keyof typeof taskStatusLabels] : null,
    priority ? taskPriorityLabels[priority as keyof typeof taskPriorityLabels] : null,
    category ? taskCategoryLabels[category as keyof typeof taskCategoryLabels] : null,
    assignedTo ? `Assigned: ${assignedTo}` : null,
    dueToday ? "Due today" : null,
    overdue ? "Overdue" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quick Tasks"
        description="Small IT follow-ups tied to assets, alerts, stock, employees, or purchases."
        action={<Link href="/tasks/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={16} />New task</Link>}
      />

      <form className="sticky top-[73px] z-20 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:static lg:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={18} />
            <input name="q" defaultValue={q} className="min-h-14 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base sm:min-h-12" placeholder="Search tasks, notes, follow-ups" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 font-semibold text-white sm:min-h-12">Search</button>
        </div>
        {activeFilters.length ? <div className="flex flex-wrap gap-2">{activeFilters.map((filter) => <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filter}</span>)}<Link href="/tasks" className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">Clear</Link></div> : null}
        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Filters</span>
            <span className="text-xs text-slate-500">{activeFilters.length ? `${activeFilters.length} active` : "Optional"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-3">
            <select name="status" defaultValue={status} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base"><option value="">All statuses</option>{taskStatusOptions.map((option) => <option key={option} value={option}>{taskStatusLabels[option]}</option>)}</select>
            <select name="priority" defaultValue={priority} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base"><option value="">All priorities</option>{taskPriorityOptions.map((option) => <option key={option} value={option}>{taskPriorityLabels[option]}</option>)}</select>
            <select name="category" defaultValue={category} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base"><option value="">All categories</option>{taskCategoryOptions.map((option) => <option key={option} value={option}>{taskCategoryLabels[option]}</option>)}</select>
            <input name="assignedTo" defaultValue={assignedTo} className="min-h-12 rounded-md border border-slate-300 px-3 text-base" placeholder="Assigned to" />
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><input name="dueToday" value="true" type="checkbox" defaultChecked={dueToday} />Due today</label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><input name="overdue" value="true" type="checkbox" defaultChecked={overdue} />Overdue</label>
            <button className="min-h-12 rounded-md bg-slate-950 px-4 font-semibold text-white md:col-span-3">Apply filters</button>
          </div>
        </details>
      </form>

      <section className="grid gap-3">
        {tasks.map((task) => {
          const related = task.relatedDevice?.name || task.relatedStockItem?.name || task.relatedFactura?.facturaNumber || task.relatedAlert?.title;
          return (
            <article key={task.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-950">{task.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{task.dueDate ? `Due ${task.dueDate.toLocaleDateString()}` : "No due date"}{task.assignedTo ? ` - ${task.assignedTo}` : ""}</p>
                </div>
                <Badge className={taskStatusTone[task.status]}>{taskStatusLabels[task.status]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={taskPriorityTone[task.priority]}>{taskPriorityLabels[task.priority]}</Badge>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{taskCategoryLabels[task.category]}</Badge>
                {related ? <Badge className="bg-blue-100 text-blue-800 ring-blue-200">{related}</Badge> : null}
              </div>
              {task.notes ? <p className="mt-3 line-clamp-2 text-sm text-slate-600">{task.notes}</p> : null}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Link href={`/tasks/${task.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">Open</Link>
                <WorkspaceStatusButton endpoint={`/api/tasks/${task.id}`} status="DONE" variant="secondary"><CheckCircle2 size={16} />Done</WorkspaceStatusButton>
                <Link href={`/tasks/${task.id}/edit`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Edit</Link>
              </div>
            </article>
          );
        })}
      </section>

      {tasks.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No tasks match this view.</p> : null}
    </div>
  );
}
