import type { AssetPhotoType, DeviceCategory, DeviceCondition, DeviceStatus } from "@prisma/client";

export type PhotoComplianceAsset = {
  category: DeviceCategory | string;
  condition?: DeviceCondition | string | null;
  status?: DeviceStatus | string | null;
  isFixedAsset?: boolean | null;
  usesStaticIp?: boolean | null;
  photos?: Array<{ photoType: AssetPhotoType | string; isPrimary?: boolean | null }>;
  rmaItems?: Array<{ result?: string | null; returnedAt?: Date | string | null }> | null;
  assignmentItems?: Array<{ returnCondition?: string | null; returnedAt?: Date | string | null }> | null;
  assetLoanItems?: Array<{ returnCondition?: string | null; returnedAt?: Date | string | null }> | null;
};

export type RequiredPhotoType = "OVERVIEW" | "ASSET_TAG" | "SERIAL_LABEL" | "CONDITION" | "DAMAGE" | "LOCATION_INSTALLED" | "RMA_CONDITION" | "RETURN_CONDITION";

const fixedCategories = new Set(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "DESKTOP", "CAMERA", "CAMERA_NVR", "NVR", "SWITCH", "ACCESS_POINT"]);
const damageConditions = new Set(["DAMAGED", "NOT_WORKING", "NEEDS_REVIEW", "MISSING_ACCESSORIES"]);
const rmaStatuses = new Set(["IN_REPAIR_RMA"]);

export const requiredPhotoLabels: Record<RequiredPhotoType, string> = {
  OVERVIEW: "Overview",
  ASSET_TAG: "Asset tag",
  SERIAL_LABEL: "Serial label",
  CONDITION: "Condition",
  DAMAGE: "Damage",
  LOCATION_INSTALLED: "Location / installed",
  RMA_CONDITION: "RMA condition",
  RETURN_CONDITION: "Return condition",
};

export function requiredPhotoTypesForAsset(asset: PhotoComplianceAsset): RequiredPhotoType[] {
  const required: RequiredPhotoType[] = ["OVERVIEW", "ASSET_TAG", "SERIAL_LABEL", "CONDITION"];
  if (isFixedPhotoAsset(asset)) required.push("LOCATION_INSTALLED");
  if (asset.condition && damageConditions.has(String(asset.condition))) required.push("DAMAGE");
  if (asset.status && rmaStatuses.has(String(asset.status))) required.push("RMA_CONDITION");
  if (hasReturnedHistory(asset)) required.push("RETURN_CONDITION");
  return [...new Set(required)];
}

export function photoTypesPresent(photos: PhotoComplianceAsset["photos"] = []) {
  const present = new Set<string>();
  for (const photo of photos) {
    present.add(String(photo.photoType));
    if (photo.photoType === "MAIN") present.add("OVERVIEW");
  }
  return present;
}

export function buildPhotoChecklist(asset: PhotoComplianceAsset) {
  const required = requiredPhotoTypesForAsset(asset);
  const present = photoTypesPresent(asset.photos);
  const items = required.map((type) => ({
    type,
    label: requiredPhotoLabels[type],
    complete: present.has(type),
  }));
  return {
    required,
    items,
    missing: items.filter((item) => !item.complete).map((item) => item.type),
    hasNoPhotos: (asset.photos?.length ?? 0) === 0,
  };
}

export function isFixedPhotoAsset(asset: Pick<PhotoComplianceAsset, "category" | "isFixedAsset" | "usesStaticIp">) {
  return Boolean(asset.isFixedAsset || asset.usesStaticIp || fixedCategories.has(String(asset.category)));
}

function hasReturnedHistory(asset: PhotoComplianceAsset) {
  return Boolean(
    asset.assignmentItems?.some((item) => item.returnedAt) ||
      asset.assetLoanItems?.some((item) => item.returnedAt) ||
      asset.rmaItems?.some((item) => item.returnedAt),
  );
}
