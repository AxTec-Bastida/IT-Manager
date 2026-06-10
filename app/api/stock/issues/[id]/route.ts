import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const issue = await prisma.stockIssue.findUnique({
    where: { id },
    include: {
      stockItem: true,
      employee: true,
      temporaryBorrower: true,
      movements: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!issue) return jsonError("Stock issue not found.", 404);
  return NextResponse.json({ issue });
}
