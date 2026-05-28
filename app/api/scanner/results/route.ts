import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const scanRuns = await prisma.scanRun.findMany({
    include: { results: true },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ scanRuns });
}
