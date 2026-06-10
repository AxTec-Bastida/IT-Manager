import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("inventory.read");
    const scanRuns = await prisma.scanRun.findMany({
      include: { results: true },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ scanRuns });
  } catch (error) {
    return handleApiError(error);
  }
}
