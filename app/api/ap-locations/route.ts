import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { normalizeMacAddress } from "@/lib/ip";
import { buildAnchorDisplayPath } from "@/lib/map-anchors";

const apLocationSchema = z.object({
  apName: z.string().trim().min(1),
  apMac: z.string().trim().min(1).transform((value) => normalizeMacAddress(value) ?? value),
  unifiDeviceId: z.string().trim().optional().nullable().transform((value) => value || null),
  locationLabel: z.string().trim().min(1),
  area: z.string().trim().optional().nullable().transform((value) => value || null),
  department: z.string().trim().optional().nullable().transform((value) => value || null),
  station: z.string().trim().optional().nullable().transform((value) => value || null),
  displayPath: z.string().trim().optional().nullable().transform((value) => value || null),
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
  try {
    await requirePermission("inventory.read");
    const accessPoints = await prisma.accessPointMapLocation.findMany({
      include: { map: true, locationZone: true },
      orderBy: [{ active: "desc" }, { displayPath: "asc" }, { locationLabel: "asc" }],
    });
    return NextResponse.json({ accessPoints });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const data = apLocationSchema.parse(await request.json());
    const accessPoint = await prisma.accessPointMapLocation.create({ data: { ...data, displayPath: buildAnchorDisplayPath(data) } });
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "map_anchor.created",
        entity: "map_anchor",
        entityId: accessPoint.id,
        message: `${accessPoint.apName} was placed on the warehouse map at ${accessPoint.displayPath ?? accessPoint.locationLabel}.`,
      },
    });
    return NextResponse.json({ accessPoint }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
