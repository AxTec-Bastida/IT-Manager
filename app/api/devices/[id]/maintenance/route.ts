import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { buildMaintenanceSummary } from "@/lib/maintenance";
import { maintenanceRecordSchema } from "@/lib/validation";
import { POST as createMaintenanceRecord } from "@/app/api/maintenance/route";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { id } = await context.params;
    const asset = await prisma.device.findUnique({
      where: { id },
      include: {
        maintenanceRecords: { include: { stockItem: true }, orderBy: { performedAt: "desc" }, take: 50 },
      },
    });
    if (!asset) return jsonError("Asset not found.", 404);
    return NextResponse.json({ asset, summary: buildMaintenanceSummary(asset), records: asset.maintenanceRecords });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = maintenanceRecordSchema.parse({ ...body, assetId: id });
    return createMaintenanceRecord(new NextRequest(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(payload),
    }));
  } catch (error) {
    return handleApiError(error);
  }
}
