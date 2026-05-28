import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const device = await prisma.device.update({ where: { id }, data: { lastSeenAt: new Date() } });
    await prisma.activityLog.create({
      data: {
        action: "device.seen",
        entity: "device",
        entityId: id,
        message: `${device.name} was marked seen from a camera scan.`,
      },
    });

    return NextResponse.json({ device });
  } catch (error) {
    return handleApiError(error);
  }
}
