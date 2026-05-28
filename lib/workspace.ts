import type { PurchaseNoteStatus, TaskStatus, ToolLink } from "@prisma/client";

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ["IN_PROGRESS", "WAITING", "DONE", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING", "DONE", "CANCELLED"],
  WAITING: ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

const purchaseTransitions: Record<PurchaseNoteStatus, PurchaseNoteStatus[]> = {
  DRAFT: ["REQUESTED", "QUOTED", "APPROVED", "ORDERED", "CANCELLED"],
  REQUESTED: ["QUOTED", "APPROVED", "ORDERED", "CANCELLED"],
  QUOTED: ["APPROVED", "ORDERED", "CANCELLED"],
  APPROVED: ["ORDERED", "CANCELLED"],
  ORDERED: ["PARTIALLY_RECEIVED", "RECEIVED", "FACTURA_PENDING", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "FACTURA_PENDING", "CANCELLED"],
  RECEIVED: ["FACTURA_PENDING", "CLOSED"],
  FACTURA_PENDING: ["CLOSED", "RECEIVED"],
  CLOSED: [],
  CANCELLED: [],
};

export function taskCanTransition(from: TaskStatus, to: TaskStatus) {
  return from === to || taskTransitions[from].includes(to);
}

export function purchaseNoteCanTransition(from: PurchaseNoteStatus, to: PurchaseNoteStatus) {
  return from === to || purchaseTransitions[from].includes(to);
}

export function isTaskOverdue(task: { dueDate: Date | null; status: TaskStatus }, now = new Date()) {
  if (!task.dueDate || ["DONE", "CANCELLED"].includes(task.status)) return false;
  return startOfDay(task.dueDate).getTime() < startOfDay(now).getTime();
}

export function isTaskDueToday(task: { dueDate: Date | null; status: TaskStatus }, now = new Date()) {
  if (!task.dueDate || ["DONE", "CANCELLED"].includes(task.status)) return false;
  return startOfDay(task.dueDate).getTime() === startOfDay(now).getTime();
}

export function isPurchaseFollowUpDue(purchase: { followUpDate: Date | null; status: PurchaseNoteStatus }, now = new Date()) {
  if (!purchase.followUpDate || ["CLOSED", "CANCELLED"].includes(purchase.status)) return false;
  return startOfDay(purchase.followUpDate).getTime() <= startOfDay(now).getTime();
}

export function favoriteToolLinks<T extends Pick<ToolLink, "isFavorite" | "active">>(links: T[]) {
  return links.filter((link) => link.active && link.isFavorite);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
