import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { stockItemSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const category = searchParams.get("category") || undefined;
  const itemType = searchParams.get("itemType") || undefined;
  const lowOnly = searchParams.get("lowOnly") === "true";

  const stockItems = await prisma.stockItem.findMany({
    where: {
      active: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { sku: { contains: query } },
              { vendorName: { contains: query } },
              { compatibleModels: { contains: query } },
              { storageLocation: { contains: query } },
            ],
          }
        : {}),
      ...(category ? { category: category as never } : {}),
      ...(itemType ? { itemType: itemType as never } : {}),
    },
    orderBy: [{ quantityOnHand: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    stockItems: lowOnly ? stockItems.filter((item) => item.quantityOnHand <= item.minimumQuantity) : stockItems,
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const data = stockItemSchema.parse(payload);
    const stockItem = await prisma.stockItem.create({ data });

    await prisma.activityLog.create({
      data: {
        action: "stock.created",
        entity: "stock",
        entityId: stockItem.id,
        message: `${stockItem.name} was added to stock inventory.`,
      },
    });

    return NextResponse.json({ stockItem }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
