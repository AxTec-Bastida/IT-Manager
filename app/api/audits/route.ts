import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { createAuditSession, estimateAuditExpectedCount, normalizeAuditInput } from "@/lib/audits";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("audits.read");
    const audits = await prisma.inventoryAuditSession.findMany({
      orderBy: [{ startedAt: "desc" }],
      include: { expectedItems: true, scans: true },
      take: 50,
    });
    return NextResponse.json({ audits });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("audits.write");
    const body = await request.json();
    const input = normalizeAuditInput(body);

    if (body.action === "estimate") {
      const expectedCount = await estimateAuditExpectedCount(input);
      return NextResponse.json({ expectedCount });
    }

    const session = await createAuditSession(input);
    return NextResponse.json({ audit: session, redirectTo: `/audits/${session.id}/scan` }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
