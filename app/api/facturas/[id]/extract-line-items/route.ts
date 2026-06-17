import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { extractFacturaCandidates } from "@/lib/factura-extraction";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  let actor: Awaited<ReturnType<typeof requirePermission>> | null = null;
  try {
    actor = await requirePermission("inventory.write");
    const factura = await prisma.factura.findUnique({ where: { id } });
    if (!factura) return jsonError("Factura not found.", 404);

    const result = await extractFacturaCandidates(factura);
    const attempt = await prisma.facturaExtractionAttempt.create({
      data: {
        facturaId: factura.id,
        status: result.status,
        candidateCount: result.candidates.length,
        warningsJson: JSON.stringify(result.warnings),
        performedByUserId: actor.id,
        performedByName: actor.name,
      },
    });
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "factura.extraction_attempted",
        entity: "factura",
        entityId: factura.id,
        message: `Factura ${factura.facturaNumber} extraction returned ${result.candidates.length} candidate line item(s).`,
        metadata: JSON.stringify({ attemptId: attempt.id, status: result.status, candidateCount: result.candidates.length, warnings: result.warnings }),
      },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      status: result.status,
      candidates: result.candidates,
      warnings: result.warnings,
    });
  } catch (error) {
    if (actor) {
      await prisma.facturaExtractionAttempt.create({
        data: {
          facturaId: id,
          status: "FAILED",
          candidateCount: 0,
          warningsJson: JSON.stringify([error instanceof Error ? error.message : "Extraction failed."]),
          performedByUserId: actor.id,
          performedByName: actor.name,
        },
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}
