import { NextRequest, NextResponse } from "next/server";
import type { InventoryAuditSessionStatus } from "@prisma/client";
import { handleApiError } from "@/lib/api";
import { closeAuditSession } from "@/lib/audits";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("audits.write");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const requested = String(body.status ?? "CLOSED");
    const status: InventoryAuditSessionStatus = requested === "REVIEW" ? "REVIEW" : "CLOSED";
    const result = await closeAuditSession(id, status);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
