export type ItemWorkflowKind = "SERIALIZED_ASSET" | "STOCK_ITEM" | "AMBIGUOUS" | "UNKNOWN";

export type WorkflowDeviceLike = {
  id?: string;
  name?: string | null;
  assetTag?: string | null;
  serialNumber?: string | null;
  category?: string | null;
  model?: string | null;
  aliases?: Array<{ aliasType: string; value: string }>;
};

export type WorkflowStockLike = {
  id?: string;
  name?: string | null;
  sku?: string | null;
  barcodeValue?: string | null;
  category?: string | null;
  itemType?: string | null;
};

const genericStockTerms = [
  "mouse",
  "mice",
  "keyboard",
  "teclado",
  "headset",
  "cable",
  "charger",
  "cargador",
  "adapter",
  "adaptor",
  "labels",
  "label",
  "ribbon",
  "toner",
  "battery",
  "batteries",
  "cleaning",
  "consumable",
  "accessory",
  "peripheral",
];

const serializedTerms = ["laptop", "desktop", "monitor", "scanner", "sled", "ipod", "iphone", "ipad", "printer", "scale", "mfp", "zebra"];
const exactAliasTypes = new Set(["PHYSICAL_LABEL", "SCAN_CODE", "LEGACY_ASSET_TAG", "OLD_AN", "LABEL_DB", "LAST_LABEL", "LEGACY_LABEL"]);

export function classifySearchTerm(value?: string | null): ItemWorkflowKind {
  const text = normalizeText(value);
  if (!text) return "UNKNOWN";
  const stock = isGenericStockSearchTerm(text);
  const serialized = isSerializedAssetSearchTerm(text);
  if (stock && serialized) return "AMBIGUOUS";
  if (stock) return "STOCK_ITEM";
  if (serialized) return "SERIALIZED_ASSET";
  return "UNKNOWN";
}

export function isGenericStockSearchTerm(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return false;
  return genericStockTerms.some((term) => wordMatches(text, term));
}

export function isSerializedAssetSearchTerm(value?: string | null) {
  const text = normalizeText(value);
  if (!text) return false;
  return serializedTerms.some((term) => wordMatches(text, term));
}

export function isExactSerializedAssetMatch(asset: WorkflowDeviceLike, value?: string | null) {
  const query = normalizeCode(value);
  if (!query) return false;
  if (normalizeCode(asset.assetTag) === query) return true;
  if (normalizeCode(asset.serialNumber) === query) return true;
  return Boolean(asset.aliases?.some((alias) => exactAliasTypes.has(alias.aliasType) && normalizeCode(alias.value) === query));
}

export function serializedAssetSearchScore(asset: WorkflowDeviceLike, value?: string | null) {
  const query = normalizeCode(value);
  const textQuery = normalizeText(value);
  if (!query) return 0;

  let score = 0;
  if (normalizeCode(asset.assetTag) === query) score = Math.max(score, 1000);
  if (asset.aliases?.some((alias) => ["PHYSICAL_LABEL", "SCAN_CODE"].includes(alias.aliasType) && normalizeCode(alias.value) === query)) score = Math.max(score, 950);
  if (normalizeCode(asset.serialNumber) === query) score = Math.max(score, 900);
  if (asset.aliases?.some((alias) => !["PHYSICAL_LABEL", "SCAN_CODE"].includes(alias.aliasType) && normalizeCode(alias.value) === query)) score = Math.max(score, 850);
  if (normalizeCode(asset.assetTag).includes(query)) score = Math.max(score, 520);
  if (normalizeCode(asset.serialNumber).includes(query)) score = Math.max(score, 500);
  if (asset.aliases?.some((alias) => normalizeCode(alias.value).includes(query))) score = Math.max(score, 480);
  if (isSerializedAssetRecord(asset) && normalizeText(`${asset.name ?? ""} ${asset.model ?? ""}`).includes(textQuery)) score = Math.max(score, 360);
  if (normalizeText(`${asset.name ?? ""} ${asset.model ?? ""}`).includes(textQuery)) score = Math.max(score, 160);

  if (isGenericStockSearchTerm(value) && !isExactSerializedAssetMatch(asset, value)) score -= 300;
  if (isGenericPeripheralLikeDevice(asset) && !isExactSerializedAssetMatch(asset, value)) score -= 150;
  return Math.max(0, score);
}

export function sortSerializedAssetMatches<T extends WorkflowDeviceLike>(assets: T[], value?: string | null) {
  if (!normalizeText(value)) return assets;
  return [...assets].sort((a, b) => serializedAssetSearchScore(b, value) - serializedAssetSearchScore(a, value) || displayKey(a).localeCompare(displayKey(b)));
}

export function stockItemSearchScore(item: WorkflowStockLike, value?: string | null) {
  const query = normalizeCode(value);
  const textQuery = normalizeText(value);
  if (!query) return 0;
  let score = 0;
  if (normalizeCode(item.barcodeValue) === query) score = Math.max(score, 1000);
  if (normalizeCode(item.sku) === query) score = Math.max(score, 900);
  if (normalizeText(item.name) === textQuery) score = Math.max(score, 850);
  if (normalizeCode(item.barcodeValue).includes(query)) score = Math.max(score, 650);
  if (normalizeCode(item.sku).includes(query)) score = Math.max(score, 600);
  if (normalizeText(item.name).includes(textQuery)) score = Math.max(score, 500);
  if (isGenericStockSearchTerm(value) && stockRecordMatchesGenericTerm(item, value)) score += 150;
  return score;
}

export function sortStockWorkflowMatches<T extends WorkflowStockLike>(items: T[], value?: string | null) {
  if (!normalizeText(value)) return items;
  return [...items].sort((a, b) => stockItemSearchScore(b, value) - stockItemSearchScore(a, value) || displayKey(a).localeCompare(displayKey(b)));
}

export function preferredWorkflowForLookup(input: { query?: string | null; devices?: WorkflowDeviceLike[]; stockItems?: WorkflowStockLike[] }) {
  const queryKind = classifySearchTerm(input.query);
  const devices = input.devices ?? [];
  const stockItems = input.stockItems ?? [];
  const hasExactSerializedAssetMatch = devices.some((device) => isExactSerializedAssetMatch(device, input.query));
  if (hasExactSerializedAssetMatch) return { preferred: "SERIALIZED_ASSET" as const, queryKind, hasExactSerializedAssetMatch };
  if (queryKind === "STOCK_ITEM" && stockItems.length > 0) return { preferred: "STOCK_ITEM" as const, queryKind, hasExactSerializedAssetMatch };
  if (queryKind === "STOCK_ITEM") return { preferred: "STOCK_ITEM" as const, queryKind, hasExactSerializedAssetMatch };
  if (devices.length && stockItems.length) return { preferred: "AMBIGUOUS" as const, queryKind, hasExactSerializedAssetMatch };
  if (devices.length) return { preferred: "SERIALIZED_ASSET" as const, queryKind, hasExactSerializedAssetMatch };
  if (stockItems.length) return { preferred: "STOCK_ITEM" as const, queryKind, hasExactSerializedAssetMatch };
  return { preferred: queryKind === "UNKNOWN" ? "UNKNOWN" as const : queryKind, queryKind, hasExactSerializedAssetMatch };
}

export function isGenericPeripheralLikeDevice(asset: WorkflowDeviceLike) {
  const text = normalizeText(`${asset.name ?? ""} ${asset.model ?? ""}`);
  if (isGenericStockSearchTerm(text)) return true;
  if (String(asset.category ?? "") === "OTHER" && /^ght-t[-_ ]?\d+/i.test(String(asset.assetTag ?? ""))) return true;
  if (String(asset.category ?? "") === "OTHER" && /^other ght-t[-_ ]?\d+/i.test(String(asset.name ?? ""))) return true;
  return false;
}

export function stockRecordLooksSerialized(item: WorkflowStockLike) {
  const text = normalizeText(`${item.name ?? ""} ${item.sku ?? ""}`);
  return serializedTerms.some((term) => wordMatches(text, term)) && !isGenericStockSearchTerm(text);
}

function stockRecordMatchesGenericTerm(item: WorkflowStockLike, value?: string | null) {
  const query = normalizeText(value);
  const text = normalizeText(`${item.name ?? ""} ${item.category ?? ""} ${item.itemType ?? ""}`);
  return query ? text.includes(query) : false;
}

function isSerializedAssetRecord(asset: WorkflowDeviceLike) {
  return ["LAPTOP", "DESKTOP", "MONITOR", "SCANNER", "PHONE", "TABLET", "THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "ACCESS_POINT", "SWITCH", "CAMERA", "CAMERA_NVR", "NVR"].includes(String(asset.category ?? ""));
}

function displayKey(item: WorkflowDeviceLike | WorkflowStockLike) {
  return normalizeText(item.name || ("assetTag" in item ? item.assetTag : null) || ("sku" in item ? item.sku : null) || item.id || "");
}

function wordMatches(text: string, word: string) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizeText(word))}([^a-z0-9]|$)`, "i").test(text);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}
