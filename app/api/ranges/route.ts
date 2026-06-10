import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ipRangeSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("inventory.read");
    const ranges = await prisma.ipRange.findMany({
      include: { _count: { select: { devices: true } } },
      orderBy: [{ active: "desc" }, { vlan: "asc" }, { startIp: "asc" }],
    });

    return NextResponse.json({ ranges });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const data = ipRangeSchema.parse(await request.json());
    const range = await prisma.ipRange.create({ data });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "range.created",
        entity: "range",
        entityId: range.id,
        message: `${range.name} was created for VLAN ${range.vlan}.`,
      },
    });

    return NextResponse.json({ range }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
