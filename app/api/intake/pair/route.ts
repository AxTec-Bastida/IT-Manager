import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, makeActivityActor } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { createFlashPairing } from "@/lib/device-pairing";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("inventory.write");
    const { sourceId, targetId, notes } = await request.json();
    if (!sourceId || !targetId) {
      return NextResponse.json({ error: "sourceId and targetId are required." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      return createFlashPairing(tx, sourceId, targetId, notes || "Paired via Pair Companion Devices.");
    });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "intake.pair_created",
        entity: "device",
        entityId: sourceId,
        message: `Device pair created between ${sourceId} and ${targetId}.`,
        metadata: JSON.stringify({ sourceId, targetId, warnings: result.warnings }),
      },
    });

    return NextResponse.json({ ok: true, warnings: result.warnings, relationship: result.relationship });
  } catch (error) {
    return handleApiError(error);
  }
}
