import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("stock.write");
    const prefix = "STK-";
    
    // Find all items that might have a code in the STK-XXXX format
    const existing = await prisma.stockItem.findMany({
      where: {
        OR: [
          { barcodeValue: { startsWith: prefix } },
          { sku: { startsWith: prefix } },
        ],
      },
      select: { barcodeValue: true, sku: true },
    });

    let maxNum = 0;
    const checkValue = (val: string | null) => {
      if (val && val.startsWith(prefix)) {
        const suffix = val.slice(prefix.length);
        const n = parseInt(suffix, 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    };

    for (const item of existing) {
      checkValue(item.barcodeValue);
      checkValue(item.sku);
    }

    const next = maxNum + 1;
    const suggested = `${prefix}${String(next).padStart(4, "0")}`;

    return NextResponse.json({ suggested });
  } catch (error) {
    return handleApiError(error);
  }
}
