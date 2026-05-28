import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { toolLinkSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const toolLink = await prisma.toolLink.findUnique({ where: { id } });
  if (!toolLink) return jsonError("Tool link not found.", 404);
  return NextResponse.json({ toolLink });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const data = toolLinkSchema.parse(payload);
    const toolLink = await prisma.toolLink.update({ where: { id }, data });

    await prisma.activityLog.create({
      data: {
        action: toolLink.active ? "tool-link.updated" : "tool-link.deactivated",
        entity: "tool-link",
        entityId: id,
        message: `${toolLink.name} was ${toolLink.active ? "updated" : "deactivated"}.`,
      },
    });

    return NextResponse.json({ toolLink });
  } catch (error) {
    return handleApiError(error);
  }
}
