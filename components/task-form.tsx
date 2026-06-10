"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { AppRole, Task } from "@prisma/client";
import { Save } from "lucide-react";
import { taskCategoryLabels, taskCategoryOptions, taskPriorityLabels, taskPriorityOptions, taskStatusLabels, taskStatusOptions } from "@/lib/constants";
import { cleanTaskCategory, type TaskAssignee, type TaskContextRecord } from "@/lib/tasks";

type TaskFormTask = Task & {
  assignedToUser?: { id: string; name: string; email: string; role: AppRole } | null;
};

type Props = {
  task?: TaskFormTask | null;
  assignees: TaskAssignee[];
  currentUserId?: string | null;
  contextRecords?: TaskContextRecord[];
  hiddenRelations?: {
    relatedDeviceId?: string | null;
    relatedEmployeeId?: string | null;
    relatedStockItemId?: string | null;
    relatedFacturaId?: string | null;
    relatedAlertId?: string | null;
  };
  suggestedCategory?: string;
  suggestedNotes?: string;
};

export function TaskForm({ task, assignees, currentUserId, contextRecords = [], hiddenRelations = {}, suggestedCategory, suggestedNotes }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const legacyAssignedTo = task?.assignedToUserId ? "" : task?.assignedTo || "";
  const defaultAssignee = task?.assignedToUserId ?? "";
  const defaultCategory = cleanTaskCategory(task?.category ?? suggestedCategory ?? searchParams.get("category") ?? "GENERAL");
  const assigneeOptions = currentUserId ? assignees.filter((user) => user.id !== currentUserId) : assignees;
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const raw = Object.fromEntries(formData.entries());
    const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save task.");
      return;
    }
    router.push(`/tasks/${data.task.id}`);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      {message ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</div> : null}
      <input type="hidden" name="relatedDeviceId" value={task?.relatedDeviceId ?? hiddenRelations.relatedDeviceId ?? searchParams.get("deviceId") ?? searchParams.get("relatedDeviceId") ?? ""} />
      <input type="hidden" name="relatedEmployeeId" value={task?.relatedEmployeeId ?? hiddenRelations.relatedEmployeeId ?? searchParams.get("employeeId") ?? searchParams.get("relatedEmployeeId") ?? ""} />
      <input type="hidden" name="relatedStockItemId" value={task?.relatedStockItemId ?? hiddenRelations.relatedStockItemId ?? searchParams.get("stockItemId") ?? searchParams.get("relatedStockItemId") ?? ""} />
      <input type="hidden" name="relatedFacturaId" value={task?.relatedFacturaId ?? hiddenRelations.relatedFacturaId ?? searchParams.get("facturaId") ?? searchParams.get("relatedFacturaId") ?? ""} />
      <input type="hidden" name="relatedAlertId" value={task?.relatedAlertId ?? hiddenRelations.relatedAlertId ?? searchParams.get("alertId") ?? searchParams.get("relatedAlertId") ?? ""} />
      {legacyAssignedTo ? <input type="hidden" name="assignedTo" value={legacyAssignedTo} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Task</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={`${labelClass} lg:col-span-2`}>
            Title
            <input className={inputClass} name="title" defaultValue={task?.title ?? searchParams.get("title") ?? ""} required />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Description
            <textarea className={inputClass} name="description" rows={3} defaultValue={task?.description ?? suggestedNotes ?? searchParams.get("notes") ?? ""} />
          </label>
          <label className={labelClass}>
            Status
            <select className={inputClass} name="status" defaultValue={task?.status ?? "OPEN"}>
              {taskStatusOptions.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Priority
            <select className={inputClass} name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
              {taskPriorityOptions.map((priority) => <option key={priority} value={priority}>{taskPriorityLabels[priority]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Category
            <select className={inputClass} name="category" defaultValue={defaultCategory}>
              {taskCategoryOptions.map((category) => <option key={category} value={category}>{taskCategoryLabels[category]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Assigned to
            <select className={inputClass} name="assignedToUserId" defaultValue={defaultAssignee}>
              <option value="">Open / Unassigned</option>
              {currentUserId ? <option value={currentUserId}>Me</option> : null}
              {assigneeOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </label>
          {legacyAssignedTo ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 lg:col-span-2">Legacy assignee text is preserved until you choose a current app user: {legacyAssignedTo}</p> : null}
          <label className={labelClass}>
            Due date
            <input className={inputClass} name="dueDate" type="date" defaultValue={task?.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""} />
          </label>
          <label className={labelClass}>
            Reminder date
            <input className={inputClass} name="reminderDate" type="date" defaultValue={task?.reminderDate ? task.reminderDate.toISOString().slice(0, 10) : ""} />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Source / related record</h2>
        <div className="mt-3 grid gap-2">
          {contextRecords.map((record) =>
            record.href ? (
              <Link key={`${record.kind}-${record.label}`} href={record.href} className="inline-flex min-h-12 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                {record.label}
              </Link>
            ) : (
              <div key={`${record.kind}-${record.label}`} className="rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">{record.label}</div>
            ),
          )}
          {contextRecords.length === 0 ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">No source selected. This task will stay general unless opened from an asset, alert, audit, stock item, RMA, employee, or factura.</p> : null}
        </div>
        <details className="mt-3 rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 cursor-pointer items-center px-3 text-sm font-semibold text-slate-700">Advanced related record IDs</summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 text-sm md:grid-cols-2">
            <p>Asset: {task?.relatedDeviceId ?? hiddenRelations.relatedDeviceId ?? searchParams.get("deviceId") ?? "-"}</p>
            <p>Employee: {task?.relatedEmployeeId ?? hiddenRelations.relatedEmployeeId ?? searchParams.get("employeeId") ?? "-"}</p>
            <p>Stock: {task?.relatedStockItemId ?? hiddenRelations.relatedStockItemId ?? searchParams.get("stockItemId") ?? "-"}</p>
            <p>Factura: {task?.relatedFacturaId ?? hiddenRelations.relatedFacturaId ?? searchParams.get("facturaId") ?? "-"}</p>
            <p>Alert: {task?.relatedAlertId ?? hiddenRelations.relatedAlertId ?? searchParams.get("alertId") ?? "-"}</p>
          </div>
        </details>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className={labelClass}>
          Notes
          <textarea className={inputClass} name="notes" rows={5} defaultValue={task?.notes ?? searchParams.get("notes") ?? suggestedNotes ?? ""} />
        </label>
      </section>

      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving}>
        <Save size={17} />
        {saving ? "Saving..." : "Save task"}
      </button>
    </form>
  );
}
