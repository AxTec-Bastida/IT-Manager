import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { suggestAssetTag } from "@/lib/intake";
import { DeviceCategory } from "@prisma/client";

export async function GET(request: NextRequest) {
  await requirePermission("inventory.write");
  const { searchParams } = new URL(request.url);
  const categoryRaw = searchParams.get("category");
  if (!categoryRaw || !(categoryRaw in DeviceCategory)) {
    return NextResponse.json({ suggested: null });
  }
  const category = categoryRaw as DeviceCategory;
  const suggested = await suggestAssetTag(prisma, category);
  return NextResponse.json({ suggested });
}
