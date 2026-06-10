import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("inventory.read");
    const conflicts = await prisma.conflict.findMany({ where: { resolved: false }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }] });
    return NextResponse.json({ conflicts });
  } catch (error) {
    return handleApiError(error);
  }
}
