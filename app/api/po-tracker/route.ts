import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { purchaseNoteSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status") || undefined;
  const vendor = searchParams.get("vendor")?.trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const purchaseNotes = await prisma.purchaseNote.findMany({
    where: {
      ...(q ? { OR: [{ poNumber: { contains: q } }, { title: { contains: q } }, { vendorName: { contains: q } }, { notes: { contains: q } }] } : {}),
      ...(status ? { status: status as never } : {}),
      ...(vendor ? { vendorName: { contains: vendor } } : {}),
      ...(searchParams.get("followUpDue") === "true" ? { followUpDate: { lte: today }, status: { notIn: ["CLOSED", "CANCELLED"] } } : {}),
      ...(searchParams.get("facturaPending") === "true" ? { status: "FACTURA_PENDING" } : {}),
    },
    include: { relatedFactura: true, items: { include: { relatedStockItem: true, relatedDevice: true } } },
    orderBy: [{ status: "asc" }, { followUpDate: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ purchaseNotes });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const data = purchaseNoteSchema.parse(payload);
    const { items, ...purchaseData } = data;
    const purchaseNote = await prisma.purchaseNote.create({
      data: {
        ...purchaseData,
        items: items.length ? { create: items } : undefined,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: "purchase-note.created",
        entity: "purchase-note",
        entityId: purchaseNote.id,
        message: `PO tracker note created: ${purchaseNote.title}.`,
      },
    });

    return NextResponse.json({ purchaseNote }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
