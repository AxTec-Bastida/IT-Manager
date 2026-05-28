import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { employee: true, items: { include: { asset: true } } },
  });
  if (!assignment) return jsonError("Assignment not found.", 404);
  return NextResponse.json({ assignment });
}
