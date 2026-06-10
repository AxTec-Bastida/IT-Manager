import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { returnAssetLoanItems } from "@/lib/asset-loans";
import { assetLoanReturnSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("loans.write");
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = assetLoanReturnSchema.parse(payload);
    const items = parsed.items.filter((item) => item.selected).map((item) => ({
      itemId: item.itemId,
      conditionIn: item.conditionIn,
      accessoriesReturned: item.accessoriesReturned,
      returnNotes: item.returnNotes,
      returnedAt: item.returnedAt,
    }));
    const loan = await returnAssetLoanItems(prisma, id, items, String(payload.returnNotes ?? ""));
    return NextResponse.json({ loan });
  } catch (error) {
    return handleApiError(error);
  }
}
