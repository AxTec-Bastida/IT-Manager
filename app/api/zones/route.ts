import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { locationZoneSchema } from "@/lib/validation";

export async function GET() {
  const zones = await prisma.locationZone.findMany({ include: { map: true, accessPoints: true, expectedAssets: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return NextResponse.json({ zones });
}

export async function POST(request: NextRequest) {
  try {
    const data = locationZoneSchema.parse(await request.json());
    const zone = await prisma.locationZone.create({ data });
    await prisma.activityLog.create({ data: { action: "zone.created", entity: "zone", entityId: zone.id, message: `${zone.name} zone was created.` } });
    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
