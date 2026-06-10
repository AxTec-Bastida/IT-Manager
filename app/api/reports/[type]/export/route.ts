import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getReportExportRows, isReportType, reportPermission, reportTypeListMessage } from "@/lib/reports";

type Context = { params: Promise<{ type: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { type } = await context.params;
    await requirePermission("inventory.read");
    if (!isReportType(type)) {
      return jsonError(`Report type must be one of: ${reportTypeListMessage()}.`, 400);
    }

    await requirePermission(reportPermission(type));
    const rows = await getReportExportRows(type);

    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="report-${type}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
