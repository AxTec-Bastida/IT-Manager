import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { runAlertRefresh } from "@/lib/alert-refresh";

export async function POST() {
  try {
    const summary = await runAlertRefresh(prisma, "MANUAL");
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
