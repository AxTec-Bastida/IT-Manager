import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { scanAuditLabel } from "@/lib/audits";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("audits.write");
    const { id } = await context.params;
    const body = await request.json();
    const result = await scanAuditLabel(id, String(body.scannedValue ?? body.value ?? ""));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
