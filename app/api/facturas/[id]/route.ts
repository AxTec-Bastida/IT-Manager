import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { normalizeLinkedIds } from "@/lib/facturas";
import { facturaSchema } from "@/lib/validation";
import { generateSafeFilename, publicUploadPath, saveUploadedFile, validateFacturaXmlUpload, validateUploadFile } from "@/lib/uploads";

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
    const actor = await requirePermission("inventory.write");
    const { id } = await context.params;
    const existing = await prisma.factura.findUnique({ where: { id } });
    if (!existing) return jsonError("Factura not found.", 404);

    const formData = await request.formData();
    const data = facturaSchema.parse(Object.fromEntries(formData.entries()));
    const assetIds = normalizeLinkedIds(formData.getAll("assetIds"));
    const stockItemIds = normalizeLinkedIds(formData.getAll("stockItemIds"));
    const stockMovementIds = normalizeLinkedIds(formData.getAll("stockMovementIds"));
    const file = formData.get("file");
    const xmlFile = formData.get("xmlFile");
    let fileData = {};
    let xmlData = {};

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

    if (xmlFile instanceof File && xmlFile.size > 0) {
      const validation = validateFacturaXmlUpload({ mimeType: xmlFile.type, fileSize: xmlFile.size, fileName: xmlFile.name });
      if (!validation.ok) return NextResponse.json({ error: validation.message }, { status: 400 });
      const mimeType = xmlFile.type || "application/xml";
      const xmlFilename = generateSafeFilename(mimeType, "factura-xml");
      await saveUploadedFile(xmlFile, "facturas", xmlFilename);
      xmlData = {
        xmlOriginalName: xmlFile.name || null,
        xmlFilename,
        xmlPath: publicUploadPath("facturas", xmlFilename),
        xmlMimeType: mimeType,
        xmlSizeBytes: xmlFile.size,
        xmlUploadedAt: new Date(),
      };
    }

    const factura = await prisma.$transaction(async (tx) => {
      const updated = await tx.factura.update({ where: { id }, data: { ...data, ...fileData, ...xmlData } });
      await tx.device.updateMany({ where: { facturaId: id }, data: { facturaId: null } });
      await tx.stockItem.updateMany({ where: { facturaId: id }, data: { facturaId: null } });
      await tx.stockMovement.updateMany({ where: { facturaId: id }, data: { facturaId: null } });
      if (assetIds.length) await tx.device.updateMany({ where: { id: { in: assetIds } }, data: { facturaId: id } });
      if (stockItemIds.length) await tx.stockItem.updateMany({ where: { id: { in: stockItemIds } }, data: { facturaId: id } });
      if (stockMovementIds.length) await tx.stockMovement.updateMany({ where: { id: { in: stockMovementIds } }, data: { facturaId: id } });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.updated",
          entity: "factura",
          entityId: id,
          message: `Factura ${updated.facturaNumber} was updated.`,
          metadata: JSON.stringify({ assetIds, stockItemIds, stockMovementIds, xmlUploaded: Boolean((xmlData as { xmlFilename?: string }).xmlFilename) }),
        },
      });
      return updated;
    });

    return NextResponse.json({ factura });
  } catch (error) {
    return handleApiError(error);
  }
}
