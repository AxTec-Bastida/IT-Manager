import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { createSingleIntakeAsset, intakeSingleAssetSchema, manualLabelsHref } from "@/lib/intake";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const input = intakeSingleAssetSchema.parse(await request.json());
    const device = await createSingleIntakeAsset(prisma, input, makeActivityActor(actor));
    return NextResponse.json({
      device,
      links: {
        openAsset: `/devices/${device.id}`,
        addPhotos: `/devices/${device.id}#photos`,
        labels: device.assetTag ? manualLabelsHref([device.assetTag]) : "/labels",
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
