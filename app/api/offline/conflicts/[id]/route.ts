import { NextResponse } from "next/server";
import { ForbiddenError, requireAuth } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { canReadOfflineConflicts, sanitizeOfflineConflictRecord } from "@/lib/offline-conflicts";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireAuth();
    if (!canReadOfflineConflicts(actor)) throw new ForbiddenError();
    const { id } = await context.params;
    const record = await prisma.offlineSyncRecord.findUnique({
      where: { id },
      include: {
        actorUser: { select: { id: true, name: true, role: true } },
        reviewedByUser: { select: { id: true, name: true, role: true } },
      },
    });
    if (!record) return jsonError("Offline sync record not found.", 404);
    return NextResponse.json({ record: sanitizeOfflineConflictRecord(record) });
  } catch (error) {
    return handleApiError(error);
  }
}
