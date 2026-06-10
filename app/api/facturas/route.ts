import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import { normalizeLinkedIds } from "@/lib/facturas";
import { facturaSchema } from "@/lib/validation";
import { generateSafeFilename, publicUploadPath, saveUploadedFile, validateUploadFile } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("inventory.read");
    const query = request.nextUrl.searchParams.get("q")?.trim();
    const facturas = await prisma.factura.findMany({
      where: query
        ? {
            OR: [
              { facturaNumber: { contains: query } },
              { vendorName: { contains: query } },
              { vendorRfc: { contains: query } },
              { poNumber: { contains: query } },
              { notes: { contains: query } },
            ],
          }
        : {},
      include: { _count: { select: { assets: true, stockItems: true, stockMovements: true } } },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ facturas });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
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
      const created = await tx.factura.create({ data: { ...data, ...fileData } });
      if (assetIds.length) await tx.device.updateMany({ where: { id: { in: assetIds } }, data: { facturaId: created.id } });
      if (stockItemIds.length) await tx.stockItem.updateMany({ where: { id: { in: stockItemIds } }, data: { facturaId: created.id } });
      if (stockMovementIds.length) await tx.stockMovement.updateMany({ where: { id: { in: stockMovementIds } }, data: { facturaId: created.id } });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "factura.created",
          entity: "factura",
          entityId: created.id,
          message: `Factura ${created.facturaNumber} from ${created.vendorName} was created.`,
          metadata: JSON.stringify({ assetIds, stockItemIds, stockMovementIds }),
        },
      });
      return created;
    });

    return NextResponse.json({ factura }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
