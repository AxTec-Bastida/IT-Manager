import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { makeActivityActor, requirePermission } from "@/lib/auth";
import {
  createBulkIntakeAssets,
  generateBulkAssetPreview,
  intakeBulkAssetSchema,
  manualLabelsHref,
  missingPhotosHref,
  validateMappingRows,
  type MappingRow,
} from "@/lib/intake";
import { resolvePhoneSledPair } from "@/lib/device-pairing";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const body = await request.json();

    if (body.mappingMode === "mapping") {
      const rows = body.rows as MappingRow[];
      const defaultCategory = body.category || "SCANNER";
      const status = body.status || "ACTIVE";
      const condition = body.condition || "GOOD";
      const defaultBrand = body.brand || null;
      const defaultModel = body.model || null;
      const defaultLocation = body.location || null;
      const defaultArea = body.areaDepartment || null;

      const createdTags: string[] = [];

      const result = await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const row of rows) {
          const deviceCategory = defaultCategory;
          const device = await tx.device.create({
            data: {
              assetTag: row.assetTag,
              name: row.brand && row.model
                ? `${row.brand} ${row.model}`
                : (row.brand || row.model || `${deviceCategory} ${row.assetTag}`),
              category: deviceCategory,
              serialNumber: row.serialNumber || null,
              status: status,
              condition: condition,
              brand: row.brand || defaultBrand,
              model: row.model || defaultModel,
              location: row.location || defaultLocation,
              areaDepartment: row.area || defaultArea,
              notes: [row.notes, "Created through bulk CSV mapping intake."].filter(Boolean).join("\n"),
            },
          });
          createdTags.push(device.assetTag!);
          count++;

          if (row.pairedTag) {
            const pairedDevice = await tx.device.findFirst({
              where: { assetTag: row.pairedTag },
            });
            if (pairedDevice) {
              const { mobileDevice, sledDevice, relationshipType } = resolvePhoneSledPair(device, pairedDevice);
              
              await tx.deviceRelationship.deleteMany({
                where: {
                  OR: [
                    { sourceDeviceId: mobileDevice.id },
                    { targetDeviceId: mobileDevice.id },
                    { sourceDeviceId: sledDevice.id },
                    { targetDeviceId: sledDevice.id },
                  ],
                  relationshipType: { in: ["IPOD_SLED_PAIR", "IPHONE_SLED_PAIR"] },
                },
              });

              await tx.deviceRelationship.create({
                data: {
                  sourceDeviceId: mobileDevice.id,
                  targetDeviceId: sledDevice.id,
                  relationshipType,
                  status: "ACTIVE",
                  notes: `Paired automatically during bulk mapping intake (row ${row.rowNum}).`,
                },
              });
            }
          }
        }
        return { count };
      });

      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "intake.bulk_assets_created",
          entity: "device",
          entityId: "bulk-intake",
          message: `${result.count} assets were created through bulk mapping intake.`,
          metadata: JSON.stringify({ count: result.count, firstTag: createdTags[0], lastTag: createdTags.at(-1) }),
        },
      });

      return NextResponse.json({
        count: result.count,
        preview: [],
        links: {
          labels: manualLabelsHref(createdTags),
          missingPhotos: "/photos/compliance",
          inventory: "/devices",
        },
      }, { status: 201 });

    } else {
      const input = intakeBulkAssetSchema.parse(body);
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
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission("inventory.write");
    const body = await request.json();

    if (body.mappingMode === "mapping") {
      const rows = body.rows as MappingRow[];
      const tags = rows.map((r) => r.assetTag).filter(Boolean);
      const serials = rows.map((r) => r.serialNumber).filter(Boolean) as string[];
      const paired = rows.map((r) => r.pairedTag).filter(Boolean) as string[];

      const [existingTagsDb, existingSerialsDb, existingPairedDb] = await Promise.all([
        prisma.device.findMany({ where: { assetTag: { in: tags } }, select: { assetTag: true } }),
        prisma.device.findMany({ where: { serialNumber: { in: serials } }, select: { serialNumber: true } }),
        prisma.device.findMany({ where: { assetTag: { in: paired } }, select: { assetTag: true } }),
      ]);

      const existingTags = new Set(existingTagsDb.map((d) => d.assetTag).filter(Boolean) as string[]);
      const existingSerials = new Set(existingSerialsDb.map((d) => d.serialNumber).filter(Boolean) as string[]);
      const existingPairedTags = new Set(existingPairedDb.map((d) => d.assetTag).filter(Boolean) as string[]);

      const validated = validateMappingRows(rows, existingTags, existingSerials, existingPairedTags);
      return NextResponse.json({
        mappingMode: "mapping",
        validated,
        existingTags: Array.from(existingTags),
        existingSerials: Array.from(existingSerials),
        existingPairedTags: Array.from(existingPairedTags),
      });
    } else {
      const input = intakeBulkAssetSchema.parse(body);
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
    }
  } catch (error) {
    return handleApiError(error);
  }
}
