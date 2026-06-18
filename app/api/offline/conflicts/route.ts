import { NextRequest, NextResponse } from "next/server";
import { ForbiddenError, requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { canReadOfflineConflicts, getOfflineConflictHealth, getOfflineConflictRecords } from "@/lib/offline-conflicts";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    if (!canReadOfflineConflicts(actor)) throw new ForbiddenError();
    const searchParams = request.nextUrl.searchParams;
    const [records, health] = await Promise.all([
      getOfflineConflictRecords({ searchParams }),
      getOfflineConflictHealth(),
    ]);
    return NextResponse.json({ records, health });
  } catch (error) {
    return handleApiError(error);
  }
}
