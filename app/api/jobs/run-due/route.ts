import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { runDueJobs } from "@/lib/jobs";
import { requireRole } from "@/lib/auth";

export async function POST() {
  try {
    await requireRole("ADMIN");
    const summary = await runDueJobs(prisma);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
