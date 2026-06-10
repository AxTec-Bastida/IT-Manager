import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { createBackup, getBackupHistory } from "@/lib/backups";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const backups = await getBackupHistory();
    return NextResponse.json({ backups });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    await requireRole("ADMIN");
    const result = await createBackup();
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
