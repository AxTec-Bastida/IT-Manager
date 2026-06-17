import { NextRequest, NextResponse } from "next/server";
import { AssetDecommissionReason } from "@prisma/client";
import { z } from "zod";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import {
  buildDecommissionBlockers,
  defaultDecommissionChecklist,
  finalStatusForDecommissionReason,
  normalizeChecklistState,
  validateDecommissionRequest,
} from "@/lib/decommission";
import { buildAssetValueSummary } from "@/lib/depreciation";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  reason: z.nativeEnum(AssetDecommissionReason),
  notes: z.string().trim().optional().nullable().transform((value) => value || null),
  checklist: z.record(z.string(), z.unknown()).optional().default({}),
  approvedByName: z.string().trim().optional().nullable().transform((value) => value || null),
  confirmation: z.literal("I understand this removes the asset from active inventory."),
});

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({
        where: { id },
        include: {
          assignmentItems: {
            where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
            include: { assignment: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          assetLoanItems: {
            where: { returnStatus: "PENDING", loan: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } },
            include: { loan: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          rmaItems: {
            where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } },
            include: { rmaCase: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          valueProfile: true,
        },
      });
      if (!device) throw new ClientInputError("Asset not found.");

      const blockers = buildDecommissionBlockers(device);
      const issues = validateDecommissionRequest({ role: actor.role, reason: payload.reason, notes: payload.notes, blockers });
      if (issues.length) throw new ClientInputError(issues.join(" "));

      const checklist = normalizeChecklistState(payload.checklist, defaultDecommissionChecklist(device.category));
      const finalStatus = finalStatusForDecommissionReason(payload.reason);
      const valueSummary = buildAssetValueSummary(device);

      const record = await tx.assetDecommissionRecord.create({
        data: {
          deviceId: device.id,
          reason: payload.reason,
          finalStatus,
          checklistJson: JSON.stringify(checklist),
          notes: payload.notes,
          estimatedValueAtDecommission: valueSummary.currentEstimatedValue,
          estimatedValueCurrency: device.valueProfile?.currency ?? null,
          approvedByName: payload.approvedByName,
          performedByUserId: actor.id,
          performedByName: actor.name,
          performedAt: now,
        },
      });

      const updatedDevice = await tx.device.update({
        where: { id: device.id },
        data: { status: finalStatus },
      });

      await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "device.decommissioned",
          entity: "device",
          entityId: device.id,
          message: `${device.name} was decommissioned with reason ${payload.reason.replaceAll("_", " ")}.`,
          metadata: JSON.stringify({
            decommissionRecordId: record.id,
            reason: payload.reason,
            previousStatus: device.status,
            finalStatus,
            estimatedValueAtDecommission: valueSummary.currentEstimatedValue,
            estimatedValueCurrency: device.valueProfile?.currency ?? null,
            checklist,
          }),
        },
      });

      return { device: updatedDevice, record };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ClientInputError && error.message === "Asset not found.") return jsonError("Asset not found.", 404);
    return handleApiError(error);
  }
}
