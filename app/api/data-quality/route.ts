import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { getDataQualityApiSummary, getDataQualityReview, summarizeDataQualityReviewForApi } from "@/lib/data-quality";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("inventory.read");
    const detail = request.nextUrl.searchParams.get("detail");
    if (!detail) {
      return NextResponse.json(await getDataQualityApiSummary());
    }

    const review = await getDataQualityReview();
    if (detail === "full") {
      return NextResponse.json(review);
    }
    return NextResponse.json(summarizeDataQualityReviewForApi(review));
  } catch (error) {
    return handleApiError(error);
  }
}
