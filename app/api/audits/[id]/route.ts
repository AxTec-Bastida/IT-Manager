import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { auditProgress } from "@/lib/audits";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    await requirePermission("audits.read");
    const { id } = await context.params;
    const audit = await prisma.inventoryAuditSession.findUnique({
      where: { id },
      include: {
        expectedItems: { include: { device: true }, orderBy: { expectedDisplayName: "asc" } },
        scans: { include: { matchedDevice: true }, orderBy: { scannedAt: "desc" } },
      },
    });
    if (!audit) return jsonError("Audit not found.", 404);
    return NextResponse.json({ audit, progress: auditProgress(audit.expectedItems, audit.scans) });
  } catch (error) {
    return handleApiError(error);
  }
}
