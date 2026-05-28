import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeInventoryStatuses } from "@/lib/constants";
import { findNextAvailableIp } from "@/lib/ip";
import { handleApiError, jsonError } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const range = await prisma.ipRange.findUnique({ where: { id } });
    if (!range) return jsonError("IP range not found.", 404);

    const devices = await prisma.device.findMany({
      where: { status: { in: activeInventoryStatuses }, ipAddress: { not: "" } },
      select: { ipAddress: true },
    });

    const suggestion = findNextAvailableIp(
      range.startIp,
      range.endIp,
      devices.map((device) => device.ipAddress).filter((ip): ip is string => Boolean(ip)),
    );

    let reservation = null;
    if (body.reserve === true && suggestion.ip) {
      reservation = await prisma.device.create({
        data: {
          name: body.name || `Reserved ${suggestion.ip}`,
          category: range.category,
          ipAddress: suggestion.ip,
          vlan: range.vlan,
          location: range.location,
          status: "RESERVED",
          notes: `Reserved from ${range.name}.`,
          ipRangeId: range.id,
        },
      });

      await prisma.activityLog.create({
        data: {
          action: "ip.reserved",
          entity: "device",
          entityId: reservation.id,
          message: `${suggestion.ip} was reserved from ${range.name}.`,
        },
      });
    }

    return NextResponse.json({ range, suggestion, reservation });
  } catch (error) {
    return handleApiError(error);
  }
}
