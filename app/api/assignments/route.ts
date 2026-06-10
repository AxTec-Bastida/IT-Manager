import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { assignmentSchema } from "@/lib/validation";
import { nextAssignmentNumber, validateAssignmentAssets } from "@/lib/assignments";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  const assignments = await prisma.assignment.findMany({
    include: { employee: true, items: { include: { asset: true } } },
    orderBy: { assignmentDate: "desc" },
  });
  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("assignments.write");
    const data = assignmentSchema.parse(await request.json());
    const assets = await prisma.device.findMany({ where: { id: { in: data.assetIds } } });
    const validation = validateAssignmentAssets(assets);
    if (!validation.ok) return jsonError(validation.message, 422);
    if (assets.length !== data.assetIds.length) return jsonError("One or more selected assets could not be found.", 422);

    const employee = data.employeeId ? await prisma.employee.findUnique({ where: { id: data.employeeId } }) : null;
    if (data.targetType === "EMPLOYEE" && !employee) return jsonError("Employee not found.", 404);
    const responsibility = await resolveAssignmentResponsibility(data, employee);

    const assignment = await prisma.$transaction(async (tx) => {
      const target = responsibility.targetPath
        ? await tx.assignmentTarget.upsert({
            where: { type_path: { type: data.targetType, path: responsibility.targetPath } },
            update: { name: responsibility.targetName, isActive: true },
            create: { type: data.targetType, name: responsibility.targetName, path: responsibility.targetPath },
          })
        : null;
      const created = await tx.assignment.create({
        data: {
          assignmentNumber: nextAssignmentNumber(),
          employeeId: employee?.id ?? null,
          targetId: target?.id ?? null,
          targetType: data.targetType,
          targetName: responsibility.targetName,
          targetPath: responsibility.targetPath,
          assignedBy: data.assignedBy,
          assignmentDate: data.assignmentDate,
          signatureData: data.signatureData,
          termsAccepted: data.termsAccepted,
          termsText: data.termsText,
          notes: data.notes,
          status: "ACTIVE",
          emailTo: employee?.email ?? null,
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
          employeeId: employee?.id ?? null,
          assignedTo: responsibility.targetPath,
        },
      });

      await tx.activityLog.create({
        data: {
          action: "assignment.created",
          entity: "assignment",
          entityId: created.id,
          message: `${created.assignmentNumber} assigned ${assets.length} asset${assets.length === 1 ? "" : "s"} to ${responsibility.targetPath}.`,
          metadata: JSON.stringify({ assetIds: assets.map((asset) => asset.id), employeeId: employee?.id ?? null, targetType: data.targetType, targetPath: responsibility.targetPath }),
        },
      });

      return created;
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

async function resolveAssignmentResponsibility(data: {
  targetType: string;
  targetName?: string | null;
  targetPath?: string | null;
}, employee: { fullName: string } | null) {
  if (data.targetType === "EMPLOYEE") {
    return { targetName: employee?.fullName ?? "Employee", targetPath: employee?.fullName ?? "Employee" };
  }
  const path = String(data.targetPath || data.targetName || "").trim().replace(/\s*>\s*/g, " > ");
  const name = String(data.targetName || path.split(">").pop() || path).trim();
  return { targetName: name, targetPath: path };
}
