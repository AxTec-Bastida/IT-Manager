import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { markOfflineConflictReviewed } from "@/lib/offline-conflicts";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reviewNote?: unknown };
    const record = await markOfflineConflictReviewed(id, actor, typeof body.reviewNote === "string" ? body.reviewNote : null);
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
