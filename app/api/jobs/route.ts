import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { ensureDefaultJobSchedules } from "@/lib/jobs";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("ADMIN");
    await ensureDefaultJobSchedules(prisma);
    const jobs = await prisma.scheduledJob.findMany({
      include: { runs: { orderBy: { startedAt: "desc" }, take: 5 } },
      orderBy: [{ enabled: "desc" }, { type: "asc" }],
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    return handleApiError(error);
  }
}
