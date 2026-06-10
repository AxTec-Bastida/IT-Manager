import { NextRequest, NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { taskSchema } from "@/lib/validation";
import { taskCanTransition } from "@/lib/workspace";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { appUserCanReceiveTasks, taskAssignmentSnapshot } from "@/lib/tasks";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("tasks.read");
    const { id } = await context.params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignedToUser: true, relatedDevice: true, relatedEmployee: true, relatedStockItem: true, relatedFactura: true, relatedAlert: true },
    });
    if (!task) return jsonError("Task not found.", 404);
    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("tasks.write");
    const { id } = await context.params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return jsonError("Task not found.", 404);
    const payload = await request.json();

    if (payload.assignToMe === true) {
      const task = await prisma.task.update({
        where: { id },
        data: taskAssignmentSnapshot(actor, null),
      });
      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "task.assigned_to_user",
          entity: "task",
          entityId: id,
          message: `${task.title} was assigned to ${actor.name}.`,
        },
      });
      return NextResponse.json({ task });
    }

    if (payload.status && Object.keys(payload).length <= 2) {
      const status = String(payload.status) as TaskStatus;
      if (!Object.values(TaskStatus).includes(status)) return jsonError("Invalid task status.", 400);
      if (!taskCanTransition(existing.status, status)) return jsonError(`Cannot move task from ${existing.status} to ${status}.`, 400);
      const task = await prisma.task.update({
        where: { id },
        data: { status, completedAt: status === "DONE" ? new Date() : existing.completedAt },
      });
      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: status === "DONE" ? "task.completed" : status === "CANCELLED" ? "task.cancelled" : "task.updated",
          entity: "task",
          entityId: id,
          message: `${task.title} status changed to ${status}.`,
          metadata: payload.note ? JSON.stringify({ note: payload.note }) : undefined,
        },
      });
      return NextResponse.json({ task });
    }

    const data = taskSchema.parse(payload);
    const assignedUser = await resolveTaskAssignedUser(data.assignedToUserId);
    if (!taskCanTransition(existing.status, data.status)) return jsonError(`Cannot move task from ${existing.status} to ${data.status}.`, 400);
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        ...taskAssignmentSnapshot(assignedUser, data.assignedTo),
        completedAt: data.status === "DONE" ? existing.completedAt ?? new Date() : data.status === "CANCELLED" ? existing.completedAt : null,
      },
    });
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: task.status === "DONE" ? "task.completed" : task.status === "CANCELLED" ? "task.cancelled" : "task.updated",
        entity: "task",
        entityId: id,
        message: `${task.title} was updated.`,
      },
    });
    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

async function resolveTaskAssignedUser(userId?: string | null) {
  if (!userId) return null;
  const user = await prisma.appUser.findUnique({ where: { id: userId } });
  if (!user || !appUserCanReceiveTasks(user)) throw new ClientInputError("Select an active Admin, IT Staff, or Auditor user for this task.");
  return user;
}
