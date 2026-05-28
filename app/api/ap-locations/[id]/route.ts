import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
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

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const accessPoint = await prisma.accessPointMapLocation.findUnique({ where: { id }, include: { map: true, locationZone: true } });
  if (!accessPoint) return jsonError("AP map location not found.", 404);
  return NextResponse.json({ accessPoint });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const data = apLocationSchema.parse(await request.json());
    const accessPoint = await prisma.accessPointMapLocation.update({ where: { id }, data });
    await prisma.activityLog.create({
      data: {
        action: "ap_location.updated",
        entity: "ap_location",
        entityId: accessPoint.id,
        message: `${accessPoint.apName} map placement was updated.`,
      },
    });
    return NextResponse.json({ accessPoint });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const accessPoint = await prisma.accessPointMapLocation.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ accessPoint });
  } catch (error) {
    return handleApiError(error);
  }
}
