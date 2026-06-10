import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { getDataQualityReview } from "@/lib/data-quality";

export async function GET() {
  try {
    await requirePermission("inventory.read");
    return NextResponse.json(await getDataQualityReview());
  } catch (error) {
    return handleApiError(error);
  }
}
