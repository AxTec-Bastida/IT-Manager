import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";

const mapSchema = z.object({
  name: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
  floorName: z.string().trim().optional().nullable().transform((value) => value || null),
  notes: z.string().trim().optional().nullable().transform((value) => value || null),
  active: z.coerce.boolean().default(true),
});

export async function GET() {
  try {
    await requirePermission("inventory.read");
    const maps = await prisma.warehouseMap.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
    return NextResponse.json({ maps });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const data = mapSchema.parse(await request.json());
    if (data.active) await prisma.warehouseMap.updateMany({ data: { active: false } });
    const map = await prisma.warehouseMap.create({ data });
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "warehouse_map.created",
        entity: "warehouse_map",
        entityId: map.id,
        message: `${map.name} warehouse map was configured from a manual path.`,
      },
    });
    return NextResponse.json({ map }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
