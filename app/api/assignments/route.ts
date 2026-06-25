import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { assignmentSchema } from "@/lib/validation";
import { nextAssignmentNumber, validateAssignmentAssets, assignmentStatusForItems } from "@/lib/assignments";
import { requirePermission, makeActivityActor } from "@/lib/auth";
import { sendAssignmentWorkflowEmail } from "@/lib/email-workflows";
import { assetLoanStatusForItems } from "@/lib/asset-loans";

export async function GET() {
  const assignments = await prisma.assignment.findMany({
    include: { employee: true, items: { include: { asset: true } } },
    orderBy: { assignmentDate: "desc" },
  });
  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("assignments.write");
    const data = assignmentSchema.parse(await request.json());
    const assets = await prisma.device.findMany({
      where: { id: { in: data.assetIds } },
      include: {
        employee: true,
        assignmentItems: {
          where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
          include: { assignment: { include: { employee: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        assetLoanItems: {
          where: { returnStatus: "PENDING", loan: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } },
          include: { loan: { include: { employee: true, temporaryBorrower: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (assets.length !== data.assetIds.length) return jsonError("One or more selected assets could not be found.", 422);

    // Identify conflicts (already assigned or loaned)
    interface Conflict {
      assetId: string;
      assetTag: string | null;
      name: string;
      type: "assignment" | "loan";
      itemId: string;
      assignmentId?: string;
      loanId?: string;
      assignedTo: string;
    }
    const conflicts: Conflict[] = [];
    for (const asset of assets) {
      if (asset.assignmentItems.length > 0) {
        const item = asset.assignmentItems[0];
        conflicts.push({
          assetId: asset.id,
          assetTag: asset.assetTag,
          name: asset.name,
          type: "assignment" as const,
          itemId: item.id,
          assignmentId: item.assignmentId,
          assignedTo: item.assignment.employee?.fullName || item.assignment.targetPath || "Someone",
        });
      } else if (asset.assetLoanItems.length > 0) {
        const item = asset.assetLoanItems[0];
        const borrower = item.loan.employee?.fullName || item.loan.temporaryBorrower?.name || "Someone";
        conflicts.push({
          assetId: asset.id,
          assetTag: asset.assetTag,
          name: asset.name,
          type: "loan" as const,
          itemId: item.id,
          loanId: item.loanId,
          assignedTo: `Loaned to ${borrower}`,
        });
      }
    }

    if (conflicts.length > 0 && !data.confirmTransfer) {
      return NextResponse.json({
        error: "already_assigned",
        message: "One or more assets are already assigned or loaned out.",
        conflicts: conflicts.map(c => ({
          assetId: c.assetId,
          assetTag: c.assetTag,
          name: c.name,
          assignedTo: c.assignedTo,
        })),
      }, { status: 422 });
    }

    // Validate using validateAssignmentAssets
    const validationAssets = assets.map(asset => {
      if (data.confirmTransfer && (asset.status === "IN_USE_ASSIGNED" || asset.status === "LOANED_OUT")) {
        return { ...asset, status: "AVAILABLE" as const };
      }
      return asset;
    });
    const validation = validateAssignmentAssets(validationAssets);
    if (!validation.ok) return jsonError(validation.message, 422);

    const employee = data.employeeId ? await prisma.employee.findUnique({ where: { id: data.employeeId } }) : null;
    if (data.targetType === "EMPLOYEE" && !employee) return jsonError("Employee not found.", 404);
    const responsibility = await resolveAssignmentResponsibility(data, employee);

    const asnNumber = nextAssignmentNumber();
    const now = new Date();

    const assignment = await prisma.$transaction(async (tx) => {
      // End conflicting assignments and loans
      for (const conflict of conflicts) {
        if (conflict.type === "assignment") {
          await tx.assignmentItem.update({
            where: { id: conflict.itemId },
            data: {
              returnedAt: now,
              returnNotes: `Transferred to assignment ${asnNumber}`,
            },
          });
          const oldAssignment = await tx.assignment.findUnique({
            where: { id: conflict.assignmentId },
            include: { items: true },
          });
          if (oldAssignment) {
            const oldStatus = assignmentStatusForItems(oldAssignment.items);
            await tx.assignment.update({
              where: { id: oldAssignment.id },
              data: { status: oldStatus },
            });
          }
        } else if (conflict.type === "loan") {
          await tx.assetLoanItem.update({
            where: { id: conflict.itemId },
            data: {
              returnedAt: now,
              returnStatus: "RETURNED",
              returnNotes: `Transferred to assignment ${asnNumber}`,
            },
          });
          const oldLoan = await tx.assetLoan.findUnique({
            where: { id: conflict.loanId },
            include: { items: true },
          });
          if (oldLoan) {
            const oldStatus = assetLoanStatusForItems(oldLoan.items);
            await tx.assetLoan.update({
              where: { id: oldLoan.id },
              data: { status: oldStatus },
            });
          }
        }
      }

      const target = responsibility.targetPath
        ? await tx.assignmentTarget.upsert({
            where: { type_path: { type: data.targetType, path: responsibility.targetPath } },
            update: { name: responsibility.targetName, isActive: true },
            create: { type: data.targetType, name: responsibility.targetName, path: responsibility.targetPath },
          })
        : null;

      const created = await tx.assignment.create({
        data: {
          assignmentNumber: asnNumber,
          employeeId: employee?.id ?? null,
          targetId: target?.id ?? null,
          targetType: data.targetType,
          targetName: responsibility.targetName,
          targetPath: responsibility.targetPath,
          assignedBy: data.assignedBy || actor.name,
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
          ...makeActivityActor(actor),
          action: "assignment.created",
          entity: "assignment",
          entityId: created.id,
          message: `${created.assignmentNumber} assigned ${assets.length} asset${assets.length === 1 ? "" : "s"} to ${responsibility.targetPath}.`,
          metadata: JSON.stringify({ assetIds: assets.map((asset) => asset.id), employeeId: employee?.id ?? null, targetType: data.targetType, targetPath: responsibility.targetPath, confirmTransfer: data.confirmTransfer }),
        },
      });

      return created;
    });

    const emailResult = await sendAssignmentWorkflowEmail(prisma, assignment.id, "receipt");

    return NextResponse.json({ assignment, emailResult }, { status: 201 });
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
