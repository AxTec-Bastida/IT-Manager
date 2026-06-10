import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { employeeSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const employees = await prisma.employee.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { fullName: { contains: q } },
              { employeeId: { contains: q } },
              { email: { contains: q } },
              { department: { contains: q } },
              { site: { contains: q } },
            ],
          }
        : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("inventory.write");
    const data = employeeSchema.parse(await request.json());
    const employee = await prisma.employee.create({ data });
    await prisma.activityLog.create({
      data: {
        action: "employee.created",
        entity: "employee",
        entityId: employee.id,
        message: `${employee.fullName} was added to Employees.`,
      },
    });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
