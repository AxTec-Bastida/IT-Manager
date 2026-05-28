import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { normalizeMacAddress } from "@/lib/ip";

const apLocationSchema = z.object({
  apName: z.string().trim().min(1),
  apMac: z.string().trim().min(1).transform((value) => normalizeMacAddress(value) ?? value),
  unifiDeviceId: z.string().trim().optional().nullable().transform((value) => value || null),
  locationLabel: z.string().trim().min(1),
  floorName: z.string().trim().optional().nullable().transform((value) => value || null),
  mapName: z.string().trim().optional().nullable().transform((value) => value || null),
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  notes: z.string().trim().optional().nullable().transform((value) => value || null),
  active: z.coerce.boolean().default(true),
  mapId: z.string().trim().optional().nullable().transform((value) => value || null),
  locationZoneId: z.string().trim().optional().nullable().transform((value) => value || null),
  zoneOrder: z.preprocess((value) => (value === "" || value == null ? null : value), z.coerce.number().int().min(0).nullable()),
});

export async function GET() {
  const accessPoints = await prisma.accessPointMapLocation.findMany({
    include: { map: true, locationZone: true },
    orderBy: [{ active: "desc" }, { locationLabel: "asc" }],
  });
  return NextResponse.json({ accessPoints });
}

export async function POST(request: NextRequest) {
  try {
    const data = apLocationSchema.parse(await request.json());
    const accessPoint = await prisma.accessPointMapLocation.create({ data });
    await prisma.activityLog.create({
      data: {
        action: "ap_location.created",
        entity: "ap_location",
        entityId: accessPoint.id,
        message: `${accessPoint.apName} was placed on the warehouse map at ${accessPoint.locationLabel}.`,
      },
    });
    return NextResponse.json({ accessPoint }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
