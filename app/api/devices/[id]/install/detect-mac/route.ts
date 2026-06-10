import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { detectMacByIp } from "@/lib/mac-discovery";
import { validateIPv4 } from "@/lib/ip";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const body = await request.json();
    const device = await prisma.device.findUnique({ where: { id }, select: { id: true } });
    if (!device) return jsonError("Device not found.", 404);
    const ipAddress = String(body.ipAddress ?? "").trim();
    const valid = validateIPv4(ipAddress);
    if (!valid.ok) return jsonError(valid.message, 422);
    const result = await detectMacByIp(ipAddress);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    return handleApiError(error);
  }
}
