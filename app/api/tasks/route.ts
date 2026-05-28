import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { taskSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const category = searchParams.get("category") || undefined;
  const assignedTo = searchParams.get("assignedTo")?.trim();
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
      ...(searchParams.get("dueToday") === "true" ? { dueDate: { gte: today, lt: tomorrow }, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
      ...(searchParams.get("overdue") === "true" ? { dueDate: { lt: today }, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
    },
    include: { relatedDevice: true, relatedEmployee: true, relatedStockItem: true, relatedFactura: true, relatedAlert: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const data = taskSchema.parse(payload);
    const task = await prisma.task.create({
      data: { ...data, completedAt: data.status === "DONE" ? new Date() : null },
    });

    await prisma.activityLog.create({
      data: {
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
