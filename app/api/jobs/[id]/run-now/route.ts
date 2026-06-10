import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { runScheduledJobNow } from "@/lib/jobs";
import { requireRole } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const job = await prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) return jsonError("Scheduled job not found.", 404);
    const result = await runScheduledJobNow(prisma, job);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
