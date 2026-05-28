import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const conflicts = await prisma.conflict.findMany({ where: { resolved: false }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ conflicts });
}
