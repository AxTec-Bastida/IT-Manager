import type { DeviceAliasType } from "@prisma/client";
import { generateRangeLabels, validateLabelPayload, type LabelItem } from "@/lib/labels";

export const physicalLabelAliasTypes = ["PHYSICAL_LABEL", "SCAN_CODE"] as const;
export type PhysicalLabelAliasType = (typeof physicalLabelAliasTypes)[number];

export type AliasLinkedAsset = {
  id: string;
  name: string;
  assetTag: string | null;
  serialNumber?: string | null;
  aliases?: Array<{ aliasType: string; value: string }>;
};

export type AliasAssignmentPreview = {
  deviceId: string;
  assetName: string;
  officialAssetTag: string | null;
  serialNumber?: string | null;
  code: string;
  aliasType: PhysicalLabelAliasType;
  conflict?: string | null;
};

export function normalizePhysicalLabelCode(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

export function normalizedAliasCompare(value: unknown) {
  return normalizePhysicalLabelCode(value).toUpperCase();
}

export function isPhysicalLabelAliasType(value: unknown): value is PhysicalLabelAliasType {
  return physicalLabelAliasTypes.includes(value as PhysicalLabelAliasType);
}

export function preferredPhysicalLabelAlias(aliases: Array<{ aliasType: string; value: string }> = []) {
  return aliases.find((alias) => alias.aliasType === "PHYSICAL_LABEL") ?? aliases.find((alias) => alias.aliasType === "SCAN_CODE") ?? null;
}

export function physicalLabelCodeForAsset(asset: AliasLinkedAsset) {
  return preferredPhysicalLabelAlias(asset.aliases)?.value ?? null;
}

export function labelItemForAsset(asset: AliasLinkedAsset, options: { usePhysicalLabel?: boolean } = {}): LabelItem | null {
  const physicalLabel = options.usePhysicalLabel ? physicalLabelCodeForAsset(asset) : null;
  const primary = physicalLabel || asset.assetTag;
  if (!primary || !validateLabelPayload(primary).ok) return null;
  return {
    deviceId: asset.id,
    assetTag: primary,
    officialAssetTag: physicalLabel ? asset.assetTag : null,
    serialNumber: asset.serialNumber,
    assetName: asset.name,
    existsInInventory: true,
    matchNote: physicalLabel ? "Physical label alias" : "Official asset tag",
  };
}

export function buildAliasAssignmentPreview(
  assets: AliasLinkedAsset[],
  input: { prefix: string; start: number; end: number; padding: number; aliasType?: string },
  existingAliases: Array<{ deviceId: string; aliasType: string; value: string }> = [],
): { ok: true; rows: AliasAssignmentPreview[]; warnings: string[] } | { ok: false; message: string; rows: AliasAssignmentPreview[] } {
  const aliasType: PhysicalLabelAliasType = isPhysicalLabelAliasType(input.aliasType) ? input.aliasType : "PHYSICAL_LABEL";
  let codes: string[];
  try {
    codes = generateRangeLabels(input).map((item) => item.assetTag);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not generate label codes.", rows: [] };
  }

  if (codes.length !== assets.length) {
    return {
      ok: false,
      message: `Generated ${codes.length} codes but selected ${assets.length} assets. Adjust selection or range.`,
      rows: assets.map((asset, index) => previewRow(asset, codes[index] ?? "", aliasType, "Count mismatch.")),
    };
  }

  const generated = new Set<string>();
  const existingByValue = new Map<string, Array<{ deviceId: string; aliasType: string; value: string }>>();
  for (const alias of existingAliases) {
    const key = normalizedAliasCompare(alias.value);
    existingByValue.set(key, [...(existingByValue.get(key) ?? []), alias]);
  }

  const rows = assets.map((asset, index) => {
    const code = codes[index];
    const key = normalizedAliasCompare(code);
    const duplicateGenerated = generated.has(key);
    generated.add(key);
    const existingForOtherAsset = (existingByValue.get(key) ?? []).find((alias) => alias.deviceId !== asset.id);
    const invalid = validateLabelPayload(code);
    const conflict = duplicateGenerated
      ? "Generated code is duplicated in this batch."
      : !invalid.ok
        ? invalid.message
        : existingForOtherAsset
          ? `Code already belongs to another asset (${existingForOtherAsset.deviceId}).`
          : null;
    return previewRow(asset, code, aliasType, conflict);
  });

  const conflicts = rows.filter((row) => row.conflict);
  if (conflicts.length) return { ok: false, message: `${conflicts.length} label code conflict(s) need review before applying.`, rows };
  return { ok: true, rows, warnings: [] };
}

export function aliasPreviewToLabelItems(rows: AliasAssignmentPreview[]): LabelItem[] {
  return rows.map((row) => ({
    deviceId: row.deviceId,
    assetTag: row.code,
    officialAssetTag: row.officialAssetTag,
    serialNumber: row.serialNumber,
    assetName: row.assetName,
    existsInInventory: true,
    matchNote: "Physical label alias",
  }));
}

export function aliasTypeForPrisma(value: string): DeviceAliasType {
  return (isPhysicalLabelAliasType(value) ? value : "PHYSICAL_LABEL") as DeviceAliasType;
}

function previewRow(asset: AliasLinkedAsset, code: string, aliasType: PhysicalLabelAliasType, conflict?: string | null): AliasAssignmentPreview {
  return {
    deviceId: asset.id,
    assetName: asset.name,
    officialAssetTag: asset.assetTag,
    serialNumber: asset.serialNumber,
    code,
    aliasType,
    conflict,
  };
}
