import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { createBulkIntakeAssets, generateBulkAssetPreview, intakeBulkAssetSchema, manualLabelsHref, missingPhotosHref } from "@/lib/intake";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const input = intakeBulkAssetSchema.parse(await request.json());
    const { count, generated } = await createBulkIntakeAssets(prisma, input, makeActivityActor(actor));
    return NextResponse.json({
      count,
      preview: generated.slice(0, 10),
      links: {
        labels: manualLabelsHref(generated.map((asset) => asset.assetTag)),
        missingPhotos: missingPhotosHref(),
        inventory: `/devices?q=${encodeURIComponent(input.prefix)}`,
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission("inventory.write");
    const input = intakeBulkAssetSchema.parse(await request.json());
    const generated = generateBulkAssetPreview(input);
    const existing = await prisma.device.findMany({
      where: { assetTag: { in: generated.map((asset) => asset.assetTag) } },
      select: { assetTag: true },
    });
    return NextResponse.json({
      total: generated.length,
      preview: generated.slice(0, 10),
      existingTags: existing.map((asset) => asset.assetTag).filter(Boolean),
      labelsHref: manualLabelsHref(generated.map((asset) => asset.assetTag)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
