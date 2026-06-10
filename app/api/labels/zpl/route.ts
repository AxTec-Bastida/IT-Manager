import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildZplLabels,
  generateBatchPatternLabels,
  generateRangeLabels,
  hasBoundedExistingLabelSelection,
  labelFilename,
  normalizeLabelOptions,
  parseLabelTagList,
  parseManualLabelList,
  validateLabelPayload,
  type LabelItem,
} from "@/lib/labels";
import { aliasPreviewToLabelItems, buildAliasAssignmentPreview, labelItemForAsset } from "@/lib/label-aliases";
import { getCalibrationTestPack } from "@/lib/label-calibration";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePermission("labels.print");
    const searchParams = new URL(request.url).searchParams;
    const labels = await labelsFromSearchParams(searchParams);
    if (!labels.length) return jsonError("No labels selected.", 422);

    const zpl = buildZplLabels(labels, normalizeLabelOptions(Object.fromEntries(searchParams.entries())));
    return new NextResponse(zpl, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${labelFilename()}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function labelsFromSearchParams(searchParams: URLSearchParams): Promise<LabelItem[]> {
  const mode = searchParams.get("mode") || "existing";

  if (mode === "range") {
    try {
      return generateRangeLabels({
        prefix: searchParams.get("prefix") || "",
        start: Number(searchParams.get("start") || "1"),
        end: Number(searchParams.get("end") || "1"),
        padding: Number(searchParams.get("padding") || "0"),
      });
    } catch (error) {
      throw new ClientInputError(error instanceof Error ? error.message : "Invalid label range.", 422);
    }
  }

  if (mode === "manual") {
    try {
      return parseManualLabelList(searchParams.get("manual") || "");
    } catch (error) {
      throw new ClientInputError(error instanceof Error ? error.message : "Invalid manual label list.", 422);
    }
  }

  if (mode === "batch") {
    try {
      return generateBatchPatternLabels({
        visibleTemplate: searchParams.get("visibleTemplate") || "K{num}",
        encodedTemplate: searchParams.get("encodedTemplate") || searchParams.get("visibleTemplate") || "K{num}",
        start: Number(searchParams.get("start") || "1"),
        end: Number(searchParams.get("end") || "24"),
        padding: Number(searchParams.get("padding") || "2"),
        maxCount: 1000,
      });
    } catch (error) {
      throw new ClientInputError(error instanceof Error ? error.message : "Invalid batch label pattern.", 422);
    }
  }

  if (mode === "calibration") {
    try {
      return getCalibrationTestPack(searchParams.get("pack")).items;
    } catch (error) {
      throw new ClientInputError(error instanceof Error ? error.message : "Invalid calibration test pack.", 422);
    }
  }

  if (mode === "alias-linked") {
    const selectedIds = [...searchParams.getAll("deviceId"), ...(searchParams.get("deviceIds") || "").split(",")].filter(Boolean);
    if (!selectedIds.length) return [];
    const [assets, existingAliases] = await Promise.all([
      prisma.device.findMany({
        where: { id: { in: selectedIds } },
        select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true } } },
        orderBy: [{ name: "asc" }],
      }),
      prisma.deviceAlias.findMany({ select: { deviceId: true, aliasType: true, value: true } }),
    ]);
    const orderedAssets = selectedIds.flatMap((id) => assets.find((asset) => asset.id === id) ?? []);
    const preview = buildAliasAssignmentPreview(
      orderedAssets,
      {
        prefix: searchParams.get("prefix") || "",
        start: Number(searchParams.get("start") || "1"),
        end: Number(searchParams.get("end") || "1"),
        padding: Number(searchParams.get("padding") || "0"),
        aliasType: searchParams.get("aliasType") || "PHYSICAL_LABEL",
      },
      existingAliases,
    );
    if (!preview.ok) throw new ClientInputError(preview.message, 422);
    return aliasPreviewToLabelItems(preview.rows);
  }

  const selectedIds = searchParams.getAll("deviceId").filter(Boolean);
  const useAlias = searchParams.get("useAlias") === "true";
  const tags = searchParams.get("tags");
  const q = searchParams.get("q");
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  if (!hasBoundedExistingLabelSelection({ selectedIds, tags, q, category, status })) {
    throw new ClientInputError("Select assets or narrow labels with search/filter before downloading ZPL.", 422);
  }

  if (tags?.trim()) {
    let requestedLabels: LabelItem[];
    try {
      requestedLabels = parseLabelTagList(tags);
    } catch (error) {
      throw new ClientInputError(error instanceof Error ? error.message : "Invalid label tag list.", 422);
    }

    const requestedTags = requestedLabels.map((label) => label.assetTag);
    const devices = await prisma.device.findMany({
      where: { assetTag: { in: requestedTags } },
      select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true }, orderBy: { createdAt: "asc" } } },
    });

    return requestedLabels.map((label) => {
      const device = devices.find((asset) => asset.assetTag?.toLowerCase() === label.assetTag.toLowerCase());
      return device ? labelItemForAsset(device, { usePhysicalLabel: useAlias }) ?? label : label;
    });
  }

  const where = selectedIds.length
    ? { id: { in: selectedIds } }
    : {
        ...(q
          ? {
              OR: [
                { assetTag: { contains: q } },
                { serialNumber: { contains: q } },
                { name: { contains: q } },
                { model: { contains: q } },
                { aliases: { some: { value: { contains: q } } } },
              ],
            }
          : {}),
        ...(category ? { category: category as never } : {}),
        ...(status ? { status: status as never } : {}),
        assetTag: { not: null },
      };

  const devices = await prisma.device.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: { id: true, name: true, assetTag: true, serialNumber: true, aliases: { select: { aliasType: true, value: true }, orderBy: { createdAt: "asc" } } },
    take: 500,
  });

  return devices.flatMap((device) => {
    const item = labelItemForAsset(device, { usePhysicalLabel: useAlias });
    if (!item) return [];
    const validation = validateLabelPayload(item.assetTag);
    if (!validation.ok) return [];
    return [item];
  });
}
