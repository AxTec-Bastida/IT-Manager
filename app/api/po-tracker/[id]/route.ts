import { NextRequest, NextResponse } from "next/server";
import { PurchaseNoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { purchaseNoteSchema } from "@/lib/validation";
import { purchaseNoteCanTransition } from "@/lib/workspace";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const purchaseNote = await prisma.purchaseNote.findUnique({
    where: { id },
    include: { relatedFactura: true, items: { include: { relatedStockItem: true, relatedDevice: true } } },
  });
  if (!purchaseNote) return jsonError("PO tracker note not found.", 404);
  return NextResponse.json({ purchaseNote });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const existing = await prisma.purchaseNote.findUnique({ where: { id } });
    if (!existing) return jsonError("PO tracker note not found.", 404);
    const payload = await request.json();

    if (payload.status && Object.keys(payload).length <= 2) {
      const status = String(payload.status) as PurchaseNoteStatus;
      if (!Object.values(PurchaseNoteStatus).includes(status)) return jsonError("Invalid PO tracker status.", 400);
      if (!purchaseNoteCanTransition(existing.status, status)) return jsonError(`Cannot move PO note from ${existing.status} to ${status}.`, 400);
      const purchaseNote = await prisma.purchaseNote.update({
        where: { id },
        data: {
          status,
          ...(status === "ORDERED" && !existing.orderedAt ? { orderedAt: new Date() } : {}),
          ...(status === "RECEIVED" && !existing.receivedAt ? { receivedAt: new Date() } : {}),
        },
      });
      await prisma.activityLog.create({
        data: {
          action: status === "CLOSED" ? "purchase-note.closed" : "purchase-note.updated",
          entity: "purchase-note",
          entityId: id,
          message: `${purchaseNote.title} status changed to ${status}.`,
        },
      });
      return NextResponse.json({ purchaseNote });
    }

    const data = purchaseNoteSchema.parse(payload);
    if (!purchaseNoteCanTransition(existing.status, data.status)) return jsonError(`Cannot move PO note from ${existing.status} to ${data.status}.`, 400);
    const { items, ...purchaseData } = data;
    const purchaseNote = await prisma.purchaseNote.update({
      where: { id },
      data: {
        ...purchaseData,
        items: {
          deleteMany: {},
          ...(items.length ? { create: items } : {}),
        },
      },
    });
    await prisma.activityLog.create({
      data: {
        action: purchaseNote.status === "CLOSED" ? "purchase-note.closed" : "purchase-note.updated",
        entity: "purchase-note",
        entityId: id,
        message: `${purchaseNote.title} was updated.`,
      },
    });
    return NextResponse.json({ purchaseNote });
  } catch (error) {
    return handleApiError(error);
  }
}
