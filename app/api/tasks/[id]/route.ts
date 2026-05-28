import { NextRequest, NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { taskSchema } from "@/lib/validation";
import { taskCanTransition } from "@/lib/workspace";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { relatedDevice: true, relatedEmployee: true, relatedStockItem: true, relatedFactura: true, relatedAlert: true },
  });
  if (!task) return jsonError("Task not found.", 404);
  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return jsonError("Task not found.", 404);
    const payload = await request.json();

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
    if (!taskCanTransition(existing.status, data.status)) return jsonError(`Cannot move task from ${existing.status} to ${data.status}.`, 400);
    const task = await prisma.task.update({
      where: { id },
      data: { ...data, completedAt: data.status === "DONE" ? existing.completedAt ?? new Date() : data.status === "CANCELLED" ? existing.completedAt : null },
    });
    await prisma.activityLog.create({
      data: {
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
