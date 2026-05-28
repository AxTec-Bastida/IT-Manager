import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { toolLinkSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category") || undefined;
  const showInactive = searchParams.get("showInactive") === "true";

  const toolLinks = await prisma.toolLink.findMany({
    where: {
      ...(showInactive ? {} : { active: true }),
      ...(category ? { category: category as never } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { url: { contains: q } }, { description: { contains: q } }, { notes: { contains: q } }] } : {}),
    },
    orderBy: [{ isFavorite: "desc" }, { category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ toolLinks });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const data = toolLinkSchema.parse(payload);
    const toolLink = await prisma.toolLink.create({ data });

    await prisma.activityLog.create({
      data: {
        action: "tool-link.created",
        entity: "tool-link",
        entityId: toolLink.id,
        message: `Tool link created: ${toolLink.name}.`,
      },
    });

    return NextResponse.json({ toolLink }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
