import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { stockIssueReturnSchema } from "@/lib/validation";
import { returnStockIssue } from "@/lib/stock-issues";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("stock.write");
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = stockIssueReturnSchema.parse(payload);
    const result = await returnStockIssue(prisma, id, parsed);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
