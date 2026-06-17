import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { calculateLineItemTotal } from "@/lib/factura-line-items";
import { prisma } from "@/lib/prisma";
import { facturaLineItemSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const payloadSchema = z.object({
  attemptId: z.string().trim().optional().nullable(),
  allowDuplicates: z.coerce.boolean().default(false),
  sourceType: z.enum(["PDF_TEXT", "XML"]).default("PDF_TEXT"),
  candidates: z.array(facturaLineItemSchema.extend({
    sourceConfidence: z.coerce.number().min(0).max(1).optional().nullable(),
    rawTextSnippet: z.string().trim().max(280).optional().nullable(),
    selected: z.coerce.boolean().default(true),
  })).min(1, "Select at least one candidate."),
});

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const factura = await prisma.factura.findUnique({ where: { id }, include: { lineItems: true } });
    if (!factura) return jsonError("Factura not found.", 404);
    const input = payloadSchema.parse(await request.json());
    const selected = input.candidates.filter((candidate) => candidate.selected);
    if (!selected.length) throw new ClientInputError("Select at least one candidate to create.");

    const duplicates = findDuplicateCandidates(factura.lineItems, selected);
    if (duplicates.length && !input.allowDuplicates) {
      throw new ClientInputError(`Possible duplicate line item(s): ${duplicates.join("; ")}. Review existing rows or enable duplicate confirmation.`, 422);
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const candidate of selected) {
        const totalCost = calculateLineItemTotal(candidate.quantity, candidate.unitCost);
        const notes = [
          candidate.notes,
          candidate.sourceConfidence != null ? `Created from ${input.sourceType} extraction candidate. Confidence: ${Math.round(candidate.sourceConfidence * 100)}%.` : `Created from ${input.sourceType} extraction candidate.`,
          candidate.rawTextSnippet ? `Source snippet: ${candidate.rawTextSnippet.slice(0, 220)}` : "",
        ].filter(Boolean).join("\n");
        const lineItem = await tx.facturaLineItem.create({
          data: {
            facturaId: factura.id,
            description: candidate.description,
            sku: candidate.sku,
            model: candidate.model,
            category: candidate.category,
            quantity: candidate.quantity,
            unitCost: candidate.unitCost,
            currency: candidate.currency,
            totalCost,
            notes,
          },
        });
        rows.push(lineItem);
        await tx.activityLog.create({
          data: {
            ...makeActivityActor(actor),
            action: "factura.line_item_created_from_extraction",
            entity: "factura",
            entityId: factura.id,
            message: `Line item ${lineItem.description} was created from reviewed ${input.sourceType} extraction for factura ${factura.facturaNumber}.`,
            metadata: JSON.stringify({ facturaLineItemId: lineItem.id, attemptId: input.attemptId ?? null, sourceType: input.sourceType, quantity: lineItem.quantity, unitCost: lineItem.unitCost, currency: lineItem.currency }),
          },
        });
      }
      if (input.attemptId) {
        await tx.facturaExtractionAttempt.updateMany({
          where: { id: input.attemptId, facturaId: factura.id },
          data: { createdLineItemCount: { increment: rows.length } },
        });
      }
      return rows;
    });

    return NextResponse.json({ lineItems: created, createdCount: created.length }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function findDuplicateCandidates(existing: Array<{ description: string; totalCost: number; quantity: number; unitCost: number }>, candidates: Array<{ description: string; quantity: number; unitCost: number }>) {
  const existingKeys = new Map(existing.map((lineItem) => [duplicateKey(lineItem.description, lineItem.quantity, lineItem.unitCost), lineItem.description]));
  return candidates
    .map((candidate) => existingKeys.get(duplicateKey(candidate.description, candidate.quantity, candidate.unitCost)))
    .filter((value): value is string => Boolean(value));
}

function duplicateKey(description: string, quantity: number, unitCost: number) {
  return `${description.trim().toLowerCase().replace(/\s+/g, " ")}|${quantity}|${Math.round(unitCost * 100) / 100}`;
}
