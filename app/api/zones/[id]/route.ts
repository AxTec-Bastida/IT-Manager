import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { locationZoneSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const zone = await prisma.locationZone.findUnique({ where: { id }, include: { map: true, accessPoints: true, expectedAssets: true } });
  if (!zone) return jsonError("Zone not found.", 404);
  return NextResponse.json({ zone });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const data = locationZoneSchema.parse(await request.json());
    const zone = await prisma.locationZone.update({ where: { id }, data });
    await prisma.activityLog.create({ data: { action: "zone.updated", entity: "zone", entityId: id, message: `${zone.name} zone was updated.` } });
    return NextResponse.json({ zone });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const zone = await prisma.locationZone.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ zone });
  } catch (error) {
    return handleApiError(error);
  }
}
