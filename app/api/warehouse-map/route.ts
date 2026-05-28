import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";

const mapSchema = z.object({
  name: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
  floorName: z.string().trim().optional().nullable().transform((value) => value || null),
  notes: z.string().trim().optional().nullable().transform((value) => value || null),
  active: z.coerce.boolean().default(true),
});

export async function GET() {
  const maps = await prisma.warehouseMap.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return NextResponse.json({ maps });
}

export async function POST(request: NextRequest) {
  try {
    const data = mapSchema.parse(await request.json());
    if (data.active) await prisma.warehouseMap.updateMany({ data: { active: false } });
    const map = await prisma.warehouseMap.create({ data });
    return NextResponse.json({ map }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
