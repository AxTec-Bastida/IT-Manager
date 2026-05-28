import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseScannedLabel } from "@/lib/scan-label";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = parseScannedLabel(String(body.value ?? ""));
  const terms = [...new Set([parsed.raw, parsed.query, parsed.ipAddress, parsed.macAddress, parsed.serialNumber, parsed.deviceName, parsed.assetTag].filter(Boolean) as string[])];

  const devices = terms.length
    ? await prisma.device.findMany({
        where: {
          OR: terms.flatMap((term) => [
            { assetTag: term },
            { assetTag: { contains: term } },
            { ipAddress: term },
            { macAddress: term },
            { serialNumber: term },
            { serialNumber: { contains: term } },
            { name: term },
            { model: { contains: term } },
            { notes: { contains: term } },
            { assignedTo: { contains: term } },
          ]),
        },
        include: {
          ipRange: true,
          employee: true,
          expectedLocationZone: true,
          alerts: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: { lastSeenAt: "desc" }, take: 5 },
          locationHistory: { orderBy: { seenAt: "desc" }, take: 1, include: { apMapLocation: { include: { locationZone: true } } } },
          unifiSnapshots: { orderBy: { syncedAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : [];

  const stockItems = terms.length
    ? await prisma.stockItem.findMany({
        where: {
          active: true,
          OR: terms.flatMap((term) => [{ sku: term }, { sku: { contains: term } }, { name: { contains: term } }, { compatibleModels: { contains: term } }, { notes: { contains: term } }]),
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : [];

  return NextResponse.json({ parsed, devices, stockItems });
}
