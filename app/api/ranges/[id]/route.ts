import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ipRangeSchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const range = await prisma.ipRange.findUnique({ where: { id }, include: { devices: true } });
  if (!range) return jsonError("IP range not found.", 404);
  return NextResponse.json({ range });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const data = ipRangeSchema.parse(await request.json());
    const range = await prisma.ipRange.update({ where: { id }, data });

    await prisma.activityLog.create({
      data: {
        action: "range.updated",
        entity: "range",
        entityId: id,
        message: `${range.name} was updated.`,
      },
    });

    return NextResponse.json({ range });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const range = await prisma.ipRange.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ range });
  } catch (error) {
    return handleApiError(error);
  }
}
