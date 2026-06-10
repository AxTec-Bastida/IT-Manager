import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClientInputError, handleApiError } from "@/lib/api";
import { taskSchema } from "@/lib/validation";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { appUserCanReceiveTasks, taskAssignmentSnapshot } from "@/lib/tasks";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requirePermission("tasks.read");
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const category = searchParams.get("category") || undefined;
    const assignedTo = searchParams.get("assignedTo")?.trim();
    const view = searchParams.get("view")?.trim();
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
        ...(view === "mine" && currentUser ? { assignedToUserId: currentUser.id } : {}),
        ...(view === "open" ? { status: { notIn: ["DONE", "CANCELLED"] } } : {}),
        ...(view === "unassigned" ? { assignedToUserId: null, assignedTo: null, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
        ...(view === "completed" ? { status: "DONE" } : {}),
        ...(searchParams.get("dueToday") === "true" ? { dueDate: { gte: today, lt: tomorrow }, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
        ...(searchParams.get("overdue") === "true" || view === "overdue" ? { dueDate: { lt: today }, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
      },
      include: { assignedToUser: true, relatedDevice: true, relatedEmployee: true, relatedStockItem: true, relatedFactura: true, relatedAlert: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("tasks.write");
    const payload = await request.json();
    const data = taskSchema.parse(payload);
    const assignedUser = await resolveTaskAssignedUser(data.assignedToUserId);
    const task = await prisma.task.create({
      data: {
        ...data,
        ...taskAssignmentSnapshot(assignedUser, data.assignedTo),
        completedAt: data.status === "DONE" ? new Date() : null,
      },
    });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "task.created",
        entity: "task",
        entityId: task.id,
        message: `Task created: ${task.title}.`,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
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
