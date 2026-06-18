import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { retryOfflineConflict } from "@/lib/offline-conflicts";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const result = await retryOfflineConflict(id, actor);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
