import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const activity = await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ activity });
}
