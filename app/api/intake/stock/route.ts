import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { intakeStock, intakeStockSchema } from "@/lib/intake";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("stock.write");
    const input = intakeStockSchema.parse(await request.json());
    const stockItem = await intakeStock(prisma, input, makeActivityActor(actor));
    return NextResponse.json({
      stockItem,
      links: {
        openStock: `/stock/${stockItem.id}`,
        issue: `/stock/issue?stockItemId=${stockItem.id}`,
        addAnother: "/intake/stock",
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
