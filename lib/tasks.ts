import type { Alert, AppRole, AppUser, Device, Employee, Factura, StockItem, Task, TaskCategory } from "@prisma/client";

export type TaskAssignee = Pick<AppUser, "id" | "name" | "email" | "role">;

export type TaskWithAssignee = Pick<Task, "assignedTo" | "assignedToName" | "assignedToRole" | "assignedToUserId"> & {
  assignedToUser?: Pick<AppUser, "name" | "role"> | null;
};

export function taskAssigneeLabel(task: TaskWithAssignee) {
  if (task.assignedToUser) return `${task.assignedToUser.name} (${task.assignedToUser.role})`;
  if (task.assignedToName) return task.assignedToRole ? `${task.assignedToName} (${task.assignedToRole})` : task.assignedToName;
  if (task.assignedTo) return `${task.assignedTo} (legacy)`;
  return "Open / Unassigned";
}

export function cleanTaskCategory(category: TaskCategory | string): TaskCategory {
  const map: Partial<Record<TaskCategory, TaskCategory>> = {
    INVENTORY: "ASSET_FOLLOW_UP",
    STOCK: "STOCK_CONSUMABLES",
    PURCHASE: "PURCHASE_PO",
    RMA: "REPAIR_RMA",
    WARRANTY: "WARRANTY_FACTURA",
    ALERT: "GENERAL",
    OTHER: "GENERAL",
  };
  return map[category as TaskCategory] ?? (category as TaskCategory);
}

export function suggestedTaskCategoryFromSource(input: { sourceType?: string | null; alertType?: string | null; deviceId?: string | null; stockItemId?: string | null; auditId?: string | null; rmaId?: string | null }): TaskCategory {
  if (input.auditId || input.sourceType === "audit") return "AUDIT_FINDING";
  if (input.rmaId || input.sourceType === "rma") return "REPAIR_RMA";
  if (input.stockItemId || input.sourceType === "stock") return "STOCK_CONSUMABLES";
  if (input.sourceType === "maintenance") return "MAINTENANCE";
  if (input.alertType) {
    const at = input.alertType;
    if (at.includes("MAINTENANCE") || at.includes("CLEANING") || at.includes("TONER") || at.includes("INK") || at.includes("DRUM") || at.includes("PRINTHEAD") || at.includes("ROLLER")) {
      return "MAINTENANCE";
    }
  }
  if (input.deviceId || input.sourceType === "asset") return "ASSET_FOLLOW_UP";
  if (input.alertType?.includes("CONFLICT") || input.alertType?.includes("IP") || input.alertType?.includes("MAC")) return "NETWORK_IP_MAC";
  if (input.alertType?.includes("WARRANTY")) return "WARRANTY_FACTURA";
  if (input.alertType?.includes("STOCK")) return "STOCK_CONSUMABLES";
  if (input.alertType?.includes("RMA")) return "REPAIR_RMA";
  if (input.sourceType === "alert") return "GENERAL";
  return "GENERAL";
}

export function appUserCanReceiveTasks(user: Pick<AppUser, "role" | "isActive">) {
  return user.isActive && ["ADMIN", "IT_STAFF", "AUDITOR"].includes(user.role);
}

export function taskAssignmentSnapshot(user: Pick<AppUser, "id" | "name" | "role"> | null, legacyAssignedTo?: string | null) {
  if (!user) return { assignedToUserId: null, assignedToName: null, assignedToRole: null as AppRole | null, assignedTo: legacyAssignedTo?.trim() || null };
  return { assignedToUserId: user.id, assignedToName: user.name, assignedToRole: user.role, assignedTo: user.name };
}

export type TaskContextRecord = {
  kind: "asset" | "employee" | "stock" | "factura" | "alert" | "audit" | "rma";
  label: string;
  href?: string;
};

export function buildTaskContextRecords(input: {
  device?: Pick<Device, "id" | "name" | "assetTag"> | null;
  employee?: Pick<Employee, "id" | "fullName" | "employeeId"> | null;
  stockItem?: Pick<StockItem, "id" | "name" | "sku"> | null;
  factura?: Pick<Factura, "id" | "facturaNumber" | "vendorName"> | null;
  alert?: Pick<Alert, "id" | "title" | "assetId"> | null;
  auditId?: string | null;
  rmaId?: string | null;
}) {
  const records: TaskContextRecord[] = [];
  if (input.device) records.push({ kind: "asset", label: `Related asset: ${input.device.assetTag ? `${input.device.assetTag} - ` : ""}${input.device.name}`, href: `/devices/${input.device.id}` });
  if (input.employee) records.push({ kind: "employee", label: `Related employee: ${input.employee.fullName}${input.employee.employeeId ? ` (${input.employee.employeeId})` : ""}`, href: `/employees/${input.employee.id}` });
  if (input.stockItem) records.push({ kind: "stock", label: `Related stock: ${input.stockItem.sku ? `${input.stockItem.sku} - ` : ""}${input.stockItem.name}`, href: `/stock/${input.stockItem.id}` });
  if (input.factura) records.push({ kind: "factura", label: `Related factura: ${input.factura.facturaNumber} - ${input.factura.vendorName}`, href: `/facturas/${input.factura.id}` });
  if (input.alert) records.push({ kind: "alert", label: `Source alert: ${input.alert.title}`, href: `/alerts?alertId=${input.alert.id}` });
  if (input.auditId) records.push({ kind: "audit", label: `Source audit: ${input.auditId}`, href: `/audits/${input.auditId}` });
  if (input.rmaId) records.push({ kind: "rma", label: `Source RMA: ${input.rmaId}`, href: `/rma/${input.rmaId}` });
  return records;
}
