import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { buildAuditExportRows, isAuditExportType } from "@/lib/audits";
import { requirePermission } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; type: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requirePermission("audits.read");
    const { id, type } = await context.params;
    if (!isAuditExportType(type)) {
      return jsonError("Export type must be audit-summary, audit-expected-items, audit-found, audit-missing, audit-wrong-area, audit-unknown-labels, audit-duplicates, audit-needs-review, or audit-all-findings.", 400);
    }

    const audit = await prisma.inventoryAuditSession.findUnique({
      where: { id },
      include: {
        expectedItems: { include: { device: true }, orderBy: { expectedDisplayName: "asc" } },
        scans: { include: { matchedDevice: true }, orderBy: { scannedAt: "asc" } },
      },
    });
    if (!audit) return jsonError("Audit not found.", 404);

    return new NextResponse(toCsv(buildAuditExportRows(audit, type)), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${audit.auditNumber || audit.id}-${type}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
