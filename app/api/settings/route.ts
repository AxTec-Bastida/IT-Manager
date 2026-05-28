import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api";

export async function GET() {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  try {
    const data = settingsSchema.parse(await request.json());
    const settings = await prisma.appSettings.update({ where: { id: "default" }, data });

    await prisma.activityLog.create({
      data: {
        action: "settings.updated",
        entity: "settings",
        entityId: "default",
        message: "Application settings were updated.",
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
