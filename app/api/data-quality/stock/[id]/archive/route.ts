import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canArchiveSuspiciousStock, detectSuspiciousStockComments } from "@/lib/data-quality";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  try {
    await requirePermission("dataQuality.cleanup");
    const { id } = await context.params;
    const stockItem = await prisma.stockItem.findUnique({
      where: { id },
      include: {
        stockIssues: { select: { status: true } },
        _count: { select: { movements: true, maintenanceRecords: true, stockIssues: true, purchaseNoteItems: true } },
      },
    });
    if (!stockItem) return jsonError("Stock item not found.", 404);
    const flagged = detectSuspiciousStockComments([stockItem])[0];
    if (!flagged) return jsonError("This stock item is not flagged as a suspicious imported comment row.", 422);
    if (!canArchiveSuspiciousStock(stockItem)) return jsonError("This stock item has usage, links, quantity, or metadata, so it was not archived.", 422);

    const archived = await prisma.$transaction(async (tx) => {
      const updated = await tx.stockItem.update({ where: { id }, data: { active: false } });
      await tx.activityLog.create({
        data: {
          action: "stock.archived_suspicious_comment",
          entity: "stock",
          entityId: id,
          message: `${stockItem.name} was archived as a suspicious legacy comment stock row.`,
          metadata: JSON.stringify({ reason: flagged.reason }),
        },
      });
      return updated;
    });

    return NextResponse.json({ stockItem: archived });
  } catch (error) {
    return handleApiError(error);
  }
}
