import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { assignmentSchema } from "@/lib/validation";
import { nextAssignmentNumber, validateAssignmentAssets } from "@/lib/assignments";

export async function GET() {
  const assignments = await prisma.assignment.findMany({
    include: { employee: true, items: { include: { asset: true } } },
    orderBy: { assignmentDate: "desc" },
  });
  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest) {
  try {
    const data = assignmentSchema.parse(await request.json());
    const assets = await prisma.device.findMany({ where: { id: { in: data.assetIds } } });
    const validation = validateAssignmentAssets(assets);
    if (!validation.ok) return jsonError(validation.message, 422);
    if (assets.length !== data.assetIds.length) return jsonError("One or more selected assets could not be found.", 422);

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) return jsonError("Employee not found.", 404);

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          assignmentNumber: nextAssignmentNumber(),
          employeeId: data.employeeId,
          assignedBy: data.assignedBy,
          assignmentDate: data.assignmentDate,
          signatureData: data.signatureData,
          termsAccepted: data.termsAccepted,
          termsText: data.termsText,
          notes: data.notes,
          status: "ACTIVE",
          emailTo: employee.email,
          items: {
            create: assets.map((asset) => ({
              assetId: asset.id,
              assignedCondition: asset.condition,
            })),
          },
        },
        include: { employee: true, items: { include: { asset: true } } },
      });

      await tx.device.updateMany({
        where: { id: { in: assets.map((asset) => asset.id) } },
        data: {
          status: "IN_USE_ASSIGNED",
          employeeId: employee.id,
          assignedTo: employee.fullName,
        },
      });

      await tx.activityLog.create({
        data: {
          action: "assignment.created",
          entity: "assignment",
          entityId: created.id,
          message: `${created.assignmentNumber} assigned ${assets.length} asset${assets.length === 1 ? "" : "s"} to ${employee.fullName}.`,
          metadata: JSON.stringify({ assetIds: assets.map((asset) => asset.id), employeeId: employee.id }),
        },
      });

      return created;
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
