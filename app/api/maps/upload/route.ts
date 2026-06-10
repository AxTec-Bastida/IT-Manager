import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { generateSafeFilename, publicUploadPath, saveUploadedFile, validateMapFileBytes } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) return jsonError("Upload a map image file.", 422);

    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateMapFileBytes(file.type, bytes);
    if (!validation.ok) return jsonError(validation.message, 422);

    const storedFilename = generateSafeFilename(file.type, "map");
    await saveUploadedFile(new File([bytes], file.name, { type: file.type }), "maps", storedFilename);

    const active = formData.get("active") == null || String(formData.get("active")) === "true" || String(formData.get("active")) === "on";
    if (active) await prisma.warehouseMap.updateMany({ data: { active: false } });

    const map = await prisma.warehouseMap.create({
      data: {
        name: String(formData.get("name") ?? "").trim() || pathlessName(file.name),
        floorName: clean(formData.get("floorName")),
        notes: clean(formData.get("notes")),
        active,
        imageUrl: publicUploadPath("maps", storedFilename),
        uploadedOriginalFilename: file.name,
        uploadedStoredFilename: storedFilename,
        uploadedMimeType: file.type,
        uploadedSizeBytes: bytes.byteLength,
        uploadedBy: actor.name ?? actor.id,
        uploadedAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(actor),
        action: "warehouse_map.uploaded",
        entity: "warehouse_map",
        entityId: map.id,
        message: `${map.name} warehouse map image was uploaded.`,
      },
    });

    return NextResponse.json({ map }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function pathlessName(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Warehouse map";
}
