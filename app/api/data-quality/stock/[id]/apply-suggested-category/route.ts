import { NextResponse } from "next/server";
import { handleApiError, ClientInputError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { suggestStockCategory } from "@/lib/stock-classification";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    await requirePermission("dataQuality.cleanup");
    const { id } = await context.params;
    const stockItem = await prisma.stockItem.findUnique({ where: { id } });
    if (!stockItem) throw new ClientInputError("Stock item not found.", 404);

    const suggestion = suggestStockCategory(stockItem);
    if (!suggestion) throw new ClientInputError("No safe category suggestion is available for this stock item.");
    if (suggestion.category === stockItem.category) throw new ClientInputError("Stock item already uses the suggested category.");

    const updated = await prisma.stockItem.update({
      where: { id },
      data: { category: suggestion.category },
    });

    await prisma.activityLog.create({
      data: {
        action: "stock.category_applied",
        entity: "StockItem",
        entityId: stockItem.id,
        message: `Applied suggested stock category for ${stockItem.name}.`,
        metadata: JSON.stringify({
          previousCategory: stockItem.category,
          newCategory: suggestion.category,
          reason: suggestion.reason,
        }),
      },
    });

    return NextResponse.json({ ok: true, stockItem: updated, previousCategory: stockItem.category, newCategory: suggestion.category });
  } catch (error) {
    return handleApiError(error);
  }
}
