import { categoryLabels } from "@/lib/constants";

type DisplayAsset = {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  assetTag?: string | null;
  serialNumber?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  usesStaticIp?: boolean | null;
  isFixedAsset?: boolean | null;
  movementAlertsEnabled?: boolean | null;
};

const identityCategories = new Set(["LAPTOP", "DESKTOP", "PHONE", "TABLET", "MONITOR", "SCANNER", "SCALE"]);
const mobileCategories = new Set(["PHONE", "TABLET"]);

export function getAssetDisplayName(asset: DisplayAsset) {
  const name = cleanText(asset.name);
  const brandModel = [cleanText(asset.brand), cleanText(asset.model)].filter(Boolean).join(" ").trim();
  const category = cleanText(asset.category);

  if (isSledAsset(asset)) {
    if (brandModel) return brandModel;
    const tag = cleanText(asset.assetTag) || cleanText(asset.serialNumber);
    return ["Sled", tag].filter(Boolean).join(" ").trim() || "Sled";
  }

  if (brandModel && (isSuspiciousImportedName(asset) || isGenericImportedName(name, category) || identityCategories.has(category))) {
    return brandModel;
  }

  if (name && !isSuspiciousImportedName(asset)) return name;
  if (brandModel) return brandModel;

  const categoryLabel = category && category in categoryLabels ? categoryLabels[category as keyof typeof categoryLabels] : titleize(category || "Asset");
  return [categoryLabel, cleanText(asset.assetTag) || cleanText(asset.serialNumber)].filter(Boolean).join(" ").trim() || "Asset";
}

export function getAssetCategoryLabel(asset: DisplayAsset) {
  if (isSledAsset(asset)) return "Sled";
  const category = cleanText(asset.category);
  return category && category in categoryLabels ? categoryLabels[category as keyof typeof categoryLabels] : titleize(category || "Asset");
}

export function getAssetIdentityLine(asset: DisplayAsset) {
  const parts = [
    asset.assetTag ? `Tag: ${asset.assetTag}` : null,
    asset.serialNumber ? `Serial: ${asset.serialNumber}` : asset.model ? `Model: ${asset.model}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "No tag or serial";
}

export function isSuspiciousImportedName(asset: DisplayAsset) {
  const name = normalize(asset.name);
  const model = normalize(asset.model);
  const category = cleanText(asset.category);
  const assetTag = normalize(asset.assetTag);
  const accessPointName = name.startsWith("access point") || name === "access point" || name.includes(" access point ");
  if (!accessPointName) return false;
  if (category === "ACCESS_POINT") return model.includes("latitude") || assetTag.startsWith("ght-lp");
  return ["LAPTOP", "DESKTOP", "PHONE", "TABLET", "OTHER"].includes(category) || model.includes("latitude");
}

export function isSledAsset(asset: DisplayAsset) {
  const text = `${asset.assetTag ?? ""} ${asset.name ?? ""} ${asset.model ?? ""} ${asset.brand ?? ""}`.toLowerCase();
  return text.includes("ght-sld") || text.includes("source: sled") || /\bsled\b/.test(text) || text.includes("infinea") || text.includes("infinite peripherals");
}

export function shouldShowNetworkSummary(asset: DisplayAsset, view?: string | null) {
  if (view === "networked" || view === "network") return Boolean(asset.ipAddress || asset.macAddress || asset.usesStaticIp || asset.isFixedAsset || asset.movementAlertsEnabled);
  if (!mobileCategories.has(cleanText(asset.category))) return Boolean(asset.ipAddress || asset.macAddress);
  return Boolean(asset.usesStaticIp || asset.isFixedAsset || asset.movementAlertsEnabled);
}

function isGenericImportedName(name: string, category: string) {
  if (!name) return false;
  const generic = new Set(["asset", "device", "equipment", "laptop", "desktop", "phone", "tablet", "monitor", "scanner", "scale"]);
  if (generic.has(name.toLowerCase())) return true;
  return Boolean(category && name.toLowerCase() === category.replaceAll("_", " ").toLowerCase());
}

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalize(value: unknown) {
  return cleanText(value).toLowerCase();
}

function titleize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
