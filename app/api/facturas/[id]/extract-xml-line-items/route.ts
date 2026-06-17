import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { extractFacturaXmlCandidates, facturaXmlMetadataData } from "@/lib/factura-xml";
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

    const result = await extractFacturaXmlCandidates(factura);
    const attempt = await prisma.$transaction(async (tx) => {
      await tx.factura.update({
        where: { id: factura.id },
        data: facturaXmlMetadataData(result.metadata),
      });
      const createdAttempt = await tx.facturaExtractionAttempt.create({
        data: {
          facturaId: factura.id,
          status: "XML_SUCCESS",
          candidateCount: result.candidates.length,
          warningsJson: JSON.stringify({ source: "XML", warnings: result.warnings, metadata: result.metadata }),
          performedByUserId: actor!.id,
          performedByName: actor!.name,
        },
      });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor!),
          action: "factura.xml_extraction_attempted",
          entity: "factura",
          entityId: factura.id,
          message: `Factura ${factura.facturaNumber} XML extraction returned ${result.candidates.length} candidate line item(s).`,
          metadata: JSON.stringify({ attemptId: createdAttempt.id, source: "XML", candidateCount: result.candidates.length, xmlUuid: result.metadata.uuid }),
        },
      });
      return createdAttempt;
    });

    return NextResponse.json({
      attemptId: attempt.id,
      sourceType: "XML",
      status: result.status,
      metadata: result.metadata,
      candidates: result.candidates,
      warnings: result.warnings,
    });
  } catch (error) {
    if (actor) {
      await prisma.facturaExtractionAttempt.create({
        data: {
          facturaId: id,
          status: "XML_FAILED",
          candidateCount: 0,
          warningsJson: JSON.stringify({ source: "XML", warnings: [error instanceof Error ? error.message : "XML extraction failed."] }),
          performedByUserId: actor.id,
          performedByName: actor.name,
        },
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}
