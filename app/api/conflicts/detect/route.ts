import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectInventoryConflicts, serializeList } from "@/lib/conflicts";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";

export async function POST() {
  try {
    const actor = await requirePermission("inventory.write");
    const devices = await prisma.device.findMany({ include: { ipRange: true } });
    const candidates = detectInventoryConflicts(devices);

    await prisma.conflict.updateMany({ where: { resolved: false }, data: { resolved: true } });

    const conflicts = await Promise.all(
      candidates.map((candidate) =>
        prisma.conflict.create({
          data: {
            type: candidate.type,
            severity: candidate.severity,
            title: candidate.title,
            description: candidate.description,
            affectedDeviceIds: serializeList(candidate.affectedDeviceIds),
            affectedIps: serializeList(candidate.affectedIps),
            suggestedFix: candidate.suggestedFix,
          },
        }),
      ),
    );

    if (conflicts.length > 0) {
      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "conflict.detected",
          entity: "conflict",
          message: `Detected ${conflicts.length} active inventory conflict${conflicts.length === 1 ? "" : "s"}.`,
        },
      });
    }

    return NextResponse.json({ conflicts });
  } catch (error) {
    return handleApiError(error);
  }
}
