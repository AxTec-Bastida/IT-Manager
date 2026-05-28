"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Alert, Device, Employee, Factura, StockItem, Task } from "@prisma/client";
import { Save } from "lucide-react";
import { taskCategoryLabels, taskCategoryOptions, taskPriorityLabels, taskPriorityOptions, taskStatusLabels, taskStatusOptions } from "@/lib/constants";

type Props = {
  task?: Task | null;
  devices: Pick<Device, "id" | "name" | "assetTag">[];
  employees: Pick<Employee, "id" | "fullName" | "employeeId">[];
  stockItems: Pick<StockItem, "id" | "name" | "sku">[];
  facturas: Pick<Factura, "id" | "facturaNumber" | "vendorName">[];
  alerts: Pick<Alert, "id" | "title">[];
};

export function TaskForm({ task, devices, employees, stockItems, facturas, alerts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputClass = "w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm";
  const labelClass = "space-y-1 text-sm font-medium text-slate-700";

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
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
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Task</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className={`${labelClass} lg:col-span-2`}>
            Title
            <input className={inputClass} name="title" defaultValue={task?.title ?? searchParams.get("title") ?? ""} required />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Description
            <textarea className={inputClass} name="description" rows={3} defaultValue={task?.description ?? ""} />
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
            <select className={inputClass} name="category" defaultValue={task?.category ?? searchParams.get("category") ?? "GENERAL"}>
              {taskCategoryOptions.map((category) => <option key={category} value={category}>{taskCategoryLabels[category]}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Assigned to
            <input className={inputClass} name="assignedTo" defaultValue={task?.assignedTo ?? ""} placeholder="Technician or team" />
          </label>
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
        <h2 className="font-semibold text-slate-950">Related record</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SelectField label="Asset" name="relatedDeviceId" value={task?.relatedDeviceId ?? searchParams.get("relatedDeviceId") ?? ""} options={devices.map((device) => ({ value: device.id, label: `${device.assetTag ? `${device.assetTag} - ` : ""}${device.name}` }))} />
          <SelectField label="Employee" name="relatedEmployeeId" value={task?.relatedEmployeeId ?? searchParams.get("relatedEmployeeId") ?? ""} options={employees.map((employee) => ({ value: employee.id, label: `${employee.fullName}${employee.employeeId ? ` (${employee.employeeId})` : ""}` }))} />
          <SelectField label="Stock item" name="relatedStockItemId" value={task?.relatedStockItemId ?? searchParams.get("relatedStockItemId") ?? ""} options={stockItems.map((item) => ({ value: item.id, label: `${item.sku ? `${item.sku} - ` : ""}${item.name}` }))} />
          <SelectField label="Factura" name="relatedFacturaId" value={task?.relatedFacturaId ?? searchParams.get("relatedFacturaId") ?? ""} options={facturas.map((factura) => ({ value: factura.id, label: `${factura.facturaNumber} - ${factura.vendorName}` }))} />
          <div className="lg:col-span-2">
            <SelectField label="Alert" name="relatedAlertId" value={task?.relatedAlertId ?? searchParams.get("relatedAlertId") ?? ""} options={alerts.map((alert) => ({ value: alert.id, label: alert.title }))} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className={labelClass}>
          Notes
          <textarea className={inputClass} name="notes" rows={4} defaultValue={task?.notes ?? searchParams.get("notes") ?? ""} />
        </label>
      </section>

      <button className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto sm:text-sm" disabled={saving}>
        <Save size={17} />
        {saving ? "Saving..." : "Save task"}
      </button>
    </form>
  );
}

function SelectField({ label, name, value, options }: { label: string; name: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1 text-sm font-medium text-slate-700">
      {label}
      <select className="w-full min-h-14 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none sm:min-h-12 sm:text-sm" name={name} defaultValue={value}>
        <option value="">No related {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
