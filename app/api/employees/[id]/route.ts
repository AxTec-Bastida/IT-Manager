import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { employeeSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { assignedDevices: true, assignments: { include: { items: { include: { asset: true } } }, orderBy: { assignmentDate: "desc" } } },
  });
  if (!employee) return jsonError("Employee not found.", 404);
  return NextResponse.json({ employee });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const data = employeeSchema.parse(await request.json());
    const employee = await prisma.employee.update({ where: { id }, data });
    await prisma.activityLog.create({
      data: {
        action: "employee.updated",
        entity: "employee",
        entityId: employee.id,
        message: `${employee.fullName} was updated.`,
      },
    });
    return NextResponse.json({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const employee = await prisma.employee.update({ where: { id }, data: { status: "INACTIVE" } });
    return NextResponse.json({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}
