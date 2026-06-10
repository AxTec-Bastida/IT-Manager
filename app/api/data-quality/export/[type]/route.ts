import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getDataQualityExportRows } from "@/lib/data-quality";

type Context = { params: Promise<{ type: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { type } = await context.params;
    const rows = await getDataQualityExportRows(type);
    if (!rows) {
      return jsonError("Export type must be duplicate-ips, skipped-duplicates, unlinked-facturas, missing-asset-tags, missing-serials, static-missing-ip-mac, mobile-network-violations, stock-review, stock-cleanup-review, suspicious-stock-comments, suspicious-asset-names, label-alias-review, sled-category-review, or missing-required-photos.", 400);
    }

    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="data-quality-${type}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
