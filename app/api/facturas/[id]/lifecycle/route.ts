import { NextRequest, NextResponse } from "next/server";
import { FacturaStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requireRole } from "@/lib/auth";
import { reviewFacturaHardDeleteSafety } from "@/lib/facturas";

type Context = { params: Promise<{ id: string }> };

const statusActions: Record<string, FacturaStatus> = {
  ARCHIVE: "ARCHIVED",
  VOID: "VOID",
  INVALID: "INVALID",
  RESTORE: "ACTIVE",
};

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requireRole("ADMIN");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "").trim().toUpperCase();
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        _count: { select: { assets: true, stockItems: true, stockMovements: true, lineItems: true, extractionAttempts: true, tasks: true, purchaseNotes: true } },
      },
    });
    if (!factura) return jsonError("Factura not found.", 404);

    if (action === "DELETE") {
      const review = reviewFacturaHardDeleteSafety(factura);
      if (!review.canHardDelete) {
        return jsonError(`Hard delete is blocked. Archive or unlink records first: ${review.blockers.join(", ")}.`, 422);
      }
      await prisma.$transaction([
        prisma.factura.delete({ where: { id } }),
        prisma.activityLog.create({
          data: {
            ...makeActivityActor(actor),
            action: "factura.deleted",
            entity: "factura",
            entityId: id,
            message: `Factura ${factura.facturaNumber} was hard-deleted after safety review.`,
          },
        }),
      ]);
      return NextResponse.json({ ok: true, message: "Factura deleted." });
    }

    const nextStatus = statusActions[action];
    if (!nextStatus) return jsonError("Action must be ARCHIVE, VOID, INVALID, RESTORE, or DELETE.", 400);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.factura.update({ where: { id }, data: { status: nextStatus } });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.lifecycle_updated",
          entity: "factura",
          entityId: id,
          message: `Factura ${factura.facturaNumber} status changed from ${factura.status} to ${nextStatus}.`,
          metadata: JSON.stringify({ previousStatus: factura.status, status: nextStatus }),
        },
      });
      return saved;
    });

    return NextResponse.json({ factura: updated, message: `Factura status changed to ${nextStatus}.` });
  } catch (error) {
    return handleApiError(error);
  }
}
