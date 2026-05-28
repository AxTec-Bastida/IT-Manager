import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { normalizeLinkedIds } from "@/lib/facturas";
import { facturaSchema } from "@/lib/validation";
import { generateSafeFilename, publicUploadPath, saveUploadedFile, validateUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      assets: { orderBy: { name: "asc" } },
      stockItems: { orderBy: { name: "asc" } },
      stockMovements: { include: { stockItem: true, asset: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!factura) return jsonError("Factura not found.", 404);
  return NextResponse.json({ factura });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const existing = await prisma.factura.findUnique({ where: { id } });
    if (!existing) return jsonError("Factura not found.", 404);

    const formData = await request.formData();
    const data = facturaSchema.parse(Object.fromEntries(formData.entries()));
    const assetIds = normalizeLinkedIds(formData.getAll("assetIds"));
    const stockItemIds = normalizeLinkedIds(formData.getAll("stockItemIds"));
    const stockMovementIds = normalizeLinkedIds(formData.getAll("stockMovementIds"));
    const file = formData.get("file");
    let fileData = {};

    if (file instanceof File && file.size > 0) {
      const validation = validateUploadFile({ kind: "factura", mimeType: file.type, fileSize: file.size });
      if (!validation.ok) return NextResponse.json({ error: validation.message }, { status: 400 });
      const storedFilename = generateSafeFilename(file.type, "factura");
      await saveUploadedFile(file, "facturas", storedFilename);
      fileData = {
        originalFilename: file.name || null,
        storedFilename,
        filePath: publicUploadPath("facturas", storedFilename),
        mimeType: file.type,
        fileSize: file.size,
      };
    }

    const factura = await prisma.$transaction(async (tx) => {
      const updated = await tx.factura.update({ where: { id }, data: { ...data, ...fileData } });
      await tx.device.updateMany({ where: { facturaId: id }, data: { facturaId: null } });
      await tx.stockItem.updateMany({ where: { facturaId: id }, data: { facturaId: null } });
      await tx.stockMovement.updateMany({ where: { facturaId: id }, data: { facturaId: null } });
      if (assetIds.length) await tx.device.updateMany({ where: { id: { in: assetIds } }, data: { facturaId: id } });
      if (stockItemIds.length) await tx.stockItem.updateMany({ where: { id: { in: stockItemIds } }, data: { facturaId: id } });
      if (stockMovementIds.length) await tx.stockMovement.updateMany({ where: { id: { in: stockMovementIds } }, data: { facturaId: id } });
      await tx.activityLog.create({
        data: {
          action: "factura.updated",
          entity: "factura",
          entityId: id,
          message: `Factura ${updated.facturaNumber} was updated.`,
          metadata: JSON.stringify({ assetIds, stockItemIds, stockMovementIds }),
        },
      });
      return updated;
    });

    return NextResponse.json({ factura });
  } catch (error) {
    return handleApiError(error);
  }
}
