import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { refreshRmaReminders } from "@/lib/rma";

export async function POST() {
  try {
    return NextResponse.json(await refreshRmaReminders(prisma));
  } catch (error) {
    return handleApiError(error);
  }
}
