import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getNextRunAt } from "@/lib/jobs";
import { handleApiError, jsonError } from "@/lib/api";
import { requireRole } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

const updateJobSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  intervalMinutes: z.coerce.number().int().min(1).max(43_200).optional(),
});

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requireRole("ADMIN");
    const { id } = await context.params;
    const data = updateJobSchema.parse(await request.json());
    const existing = await prisma.scheduledJob.findUnique({ where: { id } });
    if (!existing) return jsonError("Scheduled job not found.", 404);
    const intervalMinutes = data.intervalMinutes ?? existing.intervalMinutes;
    const job = await prisma.scheduledJob.update({
      where: { id },
      data: {
        enabled: data.enabled ?? existing.enabled,
        intervalMinutes,
        nextRunAt: data.enabled === false ? existing.nextRunAt : getNextRunAt(new Date(), intervalMinutes),
      },
    });
    return NextResponse.json({ job });
  } catch (error) {
    return handleApiError(error);
  }
}
