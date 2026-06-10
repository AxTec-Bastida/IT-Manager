import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("inventory.read");
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const vlan = searchParams.get("vlan") ? Number(searchParams.get("vlan")) : undefined;

    const devices = await prisma.device.findMany({
      where: {
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                { ipAddress: { contains: query } },
                { macAddress: { contains: query } },
                { serialNumber: { contains: query } },
                { location: { contains: query } },
                { assignedTo: { contains: query } },
              ],
            }
          : {}),
        ...(category ? { category: category as never } : {}),
        ...(status ? { status: status as never } : {}),
        ...(vlan ? { vlan } : {}),
      },
      include: { ipRange: true },
      orderBy: [{ status: "asc" }, { ipAddress: "asc" }],
    });

    return NextResponse.json({ devices });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("inventory.write");
    const payload = await request.json();
    const data = deviceSchema.parse(payload);
    const device = await prisma.device.create({ data });

    await prisma.activityLog.create({
      data: {
        action: data.status === "RESERVED" ? "ip.reserved" : "device.created",
        entity: "device",
        entityId: device.id,
        message: `${device.name} was ${data.status === "RESERVED" ? "reserved" : "created"} at ${device.ipAddress}.`,
      },
    });

    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
