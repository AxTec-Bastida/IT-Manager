import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
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

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { id } = await context.params;
    const accessPoint = await prisma.accessPointMapLocation.findUnique({ where: { id }, include: { map: true, locationZone: true } });
    if (!accessPoint) return jsonError("Map anchor not found.", 404);
    return NextResponse.json({ accessPoint });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const data = apLocationSchema.parse(await request.json());
    const accessPoint = await prisma.accessPointMapLocation.update({ where: { id }, data: { ...data, displayPath: buildAnchorDisplayPath(data) } });
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "map_anchor.updated",
        entity: "map_anchor",
        entityId: accessPoint.id,
        message: `${accessPoint.apName} map anchor was updated.`,
      },
    });
    return NextResponse.json({ accessPoint });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const accessPoint = await prisma.accessPointMapLocation.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ accessPoint });
  } catch (error) {
    return handleApiError(error);
  }
}
