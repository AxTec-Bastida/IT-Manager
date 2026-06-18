import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { processOfflineSyncBatch } from "@/lib/offline-sync";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const payload = (await request.json()) as { actions?: unknown };
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    const result = await processOfflineSyncBatch(actions as never, actor);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
