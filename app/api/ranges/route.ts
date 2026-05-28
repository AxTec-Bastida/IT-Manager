import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ipRangeSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api";

export async function GET() {
  const ranges = await prisma.ipRange.findMany({
    include: { _count: { select: { devices: true } } },
    orderBy: [{ active: "desc" }, { vlan: "asc" }, { startIp: "asc" }],
  });

  return NextResponse.json({ ranges });
}

export async function POST(request: NextRequest) {
  try {
    const data = ipRangeSchema.parse(await request.json());
    const range = await prisma.ipRange.create({ data });

    await prisma.activityLog.create({
      data: {
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
