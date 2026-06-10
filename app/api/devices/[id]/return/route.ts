import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { assignmentStatusForItems, deviceStatusForReturnCondition, itemReturnStatusForCondition, returnConditionOptions } from "@/lib/assignments";
import { requirePermission } from "@/lib/auth";
import { assignmentResponsibleLabel } from "@/lib/assignment-views";

type Context = { params: Promise<{ id: string }> };

const returnSchema = z.object({
  returnCondition: z.enum(returnConditionOptions),
  returnNotes: z.string().trim().optional().nullable().transform((value) => value || null),
});

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("assignments.write");
    const { id } = await context.params;
    const data = returnSchema.parse(await request.json());
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({ where: { id }, include: { employee: true } });
      if (!device) throw new Error("Device not found.");

      const activeItem = await tx.assignmentItem.findFirst({
        where: {
          assetId: id,
          returnedAt: null,
          assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } },
        },
        include: { assignment: { include: { employee: true, items: true } } },
        orderBy: { createdAt: "desc" },
      });

      if (!activeItem && !device.employeeId && !device.assignedTo && device.status !== "IN_USE_ASSIGNED") {
        return { device, assignment: null, item: null, changed: false };
      }

      const nextStatus = deviceStatusForReturnCondition(data.returnCondition);
      const itemReturnStatus = itemReturnStatusForCondition(data.returnCondition);

      const updatedDevice = await tx.device.update({
        where: { id },
        data: {
          employeeId: null,
          assignedTo: null,
          status: nextStatus,
          condition: data.returnCondition,
        },
      });

      let updatedAssignment = null;
      let updatedItem = null;

      if (activeItem) {
        updatedItem = await tx.assignmentItem.update({
          where: { id: activeItem.id },
          data: {
            returnedAt: now,
            returnedCondition: data.returnCondition,
            returnNotes: data.returnNotes,
            returnStatus: itemReturnStatus,
          },
        });

        const assignmentItems = activeItem.assignment.items.map((item) =>
          item.id === activeItem.id ? { ...item, returnedAt: now } : item,
        );
        const assignmentStatus = assignmentStatusForItems(assignmentItems);

        updatedAssignment = await tx.assignment.update({
          where: { id: activeItem.assignmentId },
          data: { status: assignmentStatus },
        });
      }

      await tx.activityLog.create({
        data: {
          action: "assignment.returned",
          entity: "device",
          entityId: id,
          message: `${device.name} was returned${activeItem ? ` from ${assignmentResponsibleLabel(activeItem.assignment)}` : ""}.`,
          metadata: JSON.stringify({
            assignmentId: activeItem?.assignmentId ?? null,
            assignmentItemId: activeItem?.id ?? null,
            returnCondition: data.returnCondition,
            nextStatus,
          }),
        },
      });

      return { device: updatedDevice, assignment: updatedAssignment, item: updatedItem, changed: true };
    });

    if (!result.changed) return jsonError("This asset is not currently assigned.", 422);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Device not found.") return jsonError("Device not found.", 404);
    return handleApiError(error);
  }
}
