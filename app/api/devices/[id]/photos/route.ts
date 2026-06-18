import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { createAssetPhotoUpload } from "@/lib/asset-photos";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { id } = await context.params;
    const photos = await prisma.assetPhoto.findMany({ where: { assetId: id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] });
    return NextResponse.json({ photos });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("Photo file is required.", 400);

    const result = await createAssetPhotoUpload({
      assetId: id,
      file,
      actor,
      photoType: formData.get("photoType"),
      caption: formData.get("caption"),
      source: formData.get("source"),
      compressionApplied: formData.get("compressionApplied"),
      isPrimary: formData.get("isPrimary"),
      uploadedBy: formData.get("uploadedBy"),
    });
    if (!result.ok) return jsonError(result.message, result.status);

    return NextResponse.json({ photo: result.photo }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
