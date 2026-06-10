import { NextResponse } from "next/server";
import { buildHealthPayload } from "@/lib/health";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildHealthPayload(prisma);
  const status = payload.status === "error" ? 503 : payload.status === "degraded" ? 200 : 200;
  return NextResponse.json(payload, { status });
}
