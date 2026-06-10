import { detectSuspiciousAssetNames, findDuplicateIps, summarizePhotoCompliance } from "@/lib/data-quality";
import { isAssetLikeAssignedValue, mobilePairingStatus } from "@/lib/mobile-legacy";
import { isFixedPhotoAsset } from "@/lib/photo-compliance";

export const inventoryViewOptions = [
  { id: "all", label: "All", helper: "Browse inventory" },
  { id: "needs-review", label: "Needs Review", helper: "Data issues and cleanup" },
  { id: "laptops", label: "Laptops", helper: "Laptops and desktops" },
  { id: "mobile", label: "Mobile", helper: "iPods, iPhones, iPads" },
  { id: "printers", label: "Printers", helper: "MFP and thermal printers" },
  { id: "scales", label: "Scales", helper: "Warehouse scales" },
  { id: "scanners", label: "Scanners", helper: "Scanners and scanner bases" },
  { id: "monitors", label: "Monitors", helper: "Displays and screens" },
  { id: "network", label: "Network", helper: "IP, MAC, static assets" },
  { id: "assigned", label: "Assigned", helper: "In use by employees" },
  { id: "available", label: "Available", helper: "Ready to deploy" },
  { id: "loaned", label: "Loaned", helper: "Checked out assets" },
  { id: "rma", label: "RMA", helper: "In repair or RMA" },
  { id: "missing", label: "Missing", helper: "Missing or lost assets" },
  { id: "retired", label: "Retired", helper: "Retired and disposed assets" },
  { id: "missing-photos", label: "Missing Photos", helper: "Photo checklist gaps" },
] as const;

export type InventoryViewId = (typeof inventoryViewOptions)[number]["id"];

export type InventoryAsset = {
  id: string;
  name: string;
  assetTag: string | null;
  serialNumber: string | null;
  category: string;
  status: string;
  condition?: string | null;
  brand?: string | null;
  model: string | null;
  location: string | null;
  areaDepartment: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  vlan?: number | null;
  usesStaticIp: boolean;
  isFixedAsset: boolean;
  movementAlertsEnabled: boolean;
  expectedLocationZoneId?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  employee?: { fullName: string; employeeId: string | null } | null;
  aliases?: Array<{ aliasType: string; value: string }>;
  photos?: Array<{ photoType: string; isPrimary?: boolean | null }>;
  rmaItems?: Array<{ result?: string | null; returnedAt?: Date | string | null; rmaCase?: { status?: string | null; id?: string | null; rmaNumber?: string | null } | null }>;
  assetLoanItems?: Array<{ returnStatus?: string | null; returnedAt?: Date | string | null; loan?: { status?: string | null; id?: string | null; loanNumber?: string | null } | null }>;
  assignmentItems?: Array<{ returnedAt?: Date | string | null }>;
  sourceRelationships?: Array<{ relationshipType: string; status: string; targetDeviceId: string }>;
  targetRelationships?: Array<{ relationshipType: string; status: string; sourceDeviceId: string }>;
};

export type InventorySignals = ReturnType<typeof buildInventorySignals>;

const printerCategories = new Set(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"]);
const mobileCategories = new Set(["PHONE", "TABLET"]);
const networkCategories = new Set(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "DESKTOP", "ACCESS_POINT", "SWITCH", "CAMERA", "CAMERA_NVR", "NVR"]);
const scannerCategories = new Set(["SCANNER"]);
const accessoryCategories = new Set(["DOCKING_STATION", "OTHER"]);

export function normalizeInventoryView(value?: string | null): InventoryViewId {
  if (value === "networked") return "network";
  return inventoryViewOptions.some((option) => option.id === value) ? (value as InventoryViewId) : "all";
}

export const inventoryRouteViews = inventoryViewOptions.filter((option) => option.id !== "all").map((option) => option.id);

export function shouldShowInventoryListFromParams(params: Record<string, string | null | undefined>) {
  return Boolean(
    params.list === "true" ||
      params.q ||
      params.view ||
      params.category ||
      params.status ||
      params.condition ||
      params.vlan ||
      params.employee ||
      params.location ||
      params.assigned ||
      params.hasIp ||
      params.hasMac ||
      params.conflict ||
      params.missingPhotos ||
      params.needsReview ||
      params.loaned ||
      params.inRma ||
      params.missingLost ||
      params.retired,
  );
}

export function buildInventorySignals(assets: InventoryAsset[]) {
  const duplicateIps = findDuplicateIps(assets);
  const duplicateIpIds = new Set(duplicateIps.flatMap((group) => group.assets.map((asset) => asset.id)));
  const suspiciousNames = detectSuspiciousAssetNames(assets);
  const suspiciousNameIds = new Map(suspiciousNames.map((asset) => [asset.id, asset.reason]));
  const photoCompliance = summarizePhotoCompliance(assets);
  const missingPhotoIds = new Map(photoCompliance.missingRequired.map((asset) => [asset.id, asset.checklist.missing]));
  const orphanLoanIds = new Set(assets.filter((asset) => asset.status === "LOANED_OUT" && !hasActiveLoan(asset)).map((asset) => asset.id));
  const suspiciousAssignmentIds = new Set(assets.filter((asset) => asset.assignedTo && isAssetLikeAssignedValue(asset.assignedTo)).map((asset) => asset.id));

  return { duplicateIps, duplicateIpIds, suspiciousNameIds, photoCompliance, missingPhotoIds, orphanLoanIds, suspiciousAssignmentIds };
}

export function buildInventoryOverview(assets: InventoryAsset[], signals = buildInventorySignals(assets)) {
  const needsReview = assets.filter((asset) => getInventoryReviewReasons(asset, signals).length > 0);
  return {
    total: assets.length,
    groups: {
      laptops: assets.filter((asset) => ["LAPTOP", "DESKTOP"].includes(asset.category)).length,
      mobile: assets.filter((asset) => mobileCategories.has(asset.category) || textIncludes(asset, ["ipod", "iphone", "ipad"])).length,
      printers: assets.filter((asset) => printerCategories.has(asset.category)).length,
      scales: assets.filter((asset) => asset.category === "SCALE").length,
      scanners: assets.filter((asset) => scannerCategories.has(asset.category)).length,
      monitors: assets.filter((asset) => asset.category === "MONITOR").length,
      network: assets.filter((asset) => ["ACCESS_POINT", "SWITCH", "CAMERA", "CAMERA_NVR", "NVR"].includes(asset.category)).length,
      accessories: assets.filter((asset) => accessoryCategories.has(asset.category)).length,
    },
    workflows: {
      assigned: assets.filter(isAssignedAsset).length,
      available: assets.filter((asset) => ["AVAILABLE", "ACTIVE", "RESERVED"].includes(asset.status) && !isAssignedAsset(asset)).length,
      loaned: assets.filter(isLoanedAsset).length,
      rma: assets.filter(isRmaAsset).length,
      missingLost: assets.filter((asset) => ["MISSING", "LOST"].includes(asset.status)).length,
      retired: assets.filter((asset) => ["RETIRED", "DISPOSED"].includes(asset.status)).length,
      needsReview: needsReview.length,
      missingPhotos: signals.missingPhotoIds.size,
    },
    network: {
      withIp: assets.filter((asset) => asset.ipAddress).length,
      withMac: assets.filter((asset) => asset.macAddress).length,
      duplicateIps: signals.duplicateIps.length,
      staticCandidates: assets.filter(isStaticCandidate).length,
      fixedMissingIpMac: assets.filter((asset) => isStaticCandidate(asset) && (!asset.ipAddress || !asset.macAddress)).length,
    },
  };
}

export function filterInventoryAssets(
  assets: InventoryAsset[],
  params: {
    view?: string | null;
    q?: string | null;
    category?: string | null;
    status?: string | null;
    condition?: string | null;
    employee?: string | null;
    assigned?: string | null;
    location?: string | null;
    vlan?: string | null;
    hasIp?: string | null;
    hasMac?: string | null;
    missingPhotos?: string | null;
    needsReview?: string | null;
    inRma?: string | null;
    loaned?: string | null;
    missingLost?: string | null;
    retired?: string | null;
    conflict?: string | null;
  },
  signals = buildInventorySignals(assets),
) {
  const view = normalizeInventoryView(params.view);
  const query = normalize(params.q);
  const employee = normalize(params.employee);
  const location = normalize(params.location);

  return assets.filter((asset) => {
    const reviewReasons = getInventoryReviewReasons(asset, signals);
    const matchesView = matchesInventoryView(asset, view, signals);
    const matchesSearch =
      !query ||
      [asset.assetTag, asset.name, asset.ipAddress, asset.macAddress, asset.serialNumber, asset.location, asset.areaDepartment, asset.brand, asset.model, asset.assignedTo, asset.employee?.fullName, ...(asset.aliases ?? []).map((alias) => alias.value)]
        .filter(Boolean)
        .some((value) => normalize(value).includes(query));
    const matchesEmployee = !employee || [asset.assignedTo, asset.employee?.fullName, asset.employee?.employeeId].filter(Boolean).some((value) => normalize(value).includes(employee));
    const matchesLocation = !location || [asset.location, asset.areaDepartment].filter(Boolean).some((value) => normalize(value).includes(location));
    const matchesConflict = !params.conflict || (params.conflict === "yes" ? signals.duplicateIpIds.has(asset.id) : !signals.duplicateIpIds.has(asset.id));

    return (
      matchesView &&
      matchesSearch &&
      (!params.category || asset.category === params.category) &&
      (!params.status || asset.status === params.status) &&
      (!params.condition || asset.condition === params.condition) &&
      (!params.vlan || asset.vlan === Number(params.vlan)) &&
      matchesEmployee &&
      matchesLocation &&
      (!params.assigned || (params.assigned === "yes" ? isAssignedAsset(asset) : !isAssignedAsset(asset))) &&
      (!params.hasIp || (params.hasIp === "yes" ? Boolean(asset.ipAddress) : !asset.ipAddress)) &&
      (!params.hasMac || (params.hasMac === "yes" ? Boolean(asset.macAddress) : !asset.macAddress)) &&
      (params.missingPhotos !== "true" || signals.missingPhotoIds.has(asset.id)) &&
      (params.needsReview !== "true" || reviewReasons.length > 0) &&
      (params.inRma !== "true" || isRmaAsset(asset)) &&
      (params.loaned !== "true" || isLoanedAsset(asset)) &&
      (params.missingLost !== "true" || ["MISSING", "LOST"].includes(asset.status)) &&
      (params.retired !== "true" || ["RETIRED", "DISPOSED"].includes(asset.status)) &&
      matchesConflict
    );
  });
}

export function inventorySearchScore(asset: InventoryAsset, query?: string | null) {
  const normalizedQuery = normalizeCode(query);
  const textQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const assetTag = normalizeCode(asset.assetTag);
  const serial = normalizeCode(asset.serialNumber);
  const aliases = asset.aliases ?? [];
  const preferredAliases = aliases.filter((alias) => ["PHYSICAL_LABEL", "SCAN_CODE"].includes(String(alias.aliasType ?? "")));
  const legacyAliases = aliases.filter((alias) => !["PHYSICAL_LABEL", "SCAN_CODE"].includes(String(alias.aliasType ?? "")));

  let score = 0;
  if (assetTag === normalizedQuery) score = Math.max(score, 1000);
  if (preferredAliases.some((alias) => normalizeCode(alias.value) === normalizedQuery)) score = Math.max(score, 950);
  if (serial === normalizedQuery) score = Math.max(score, 900);
  if (legacyAliases.some((alias) => normalizeCode(alias.value) === normalizedQuery)) score = Math.max(score, 850);
  if (assetTag.includes(normalizedQuery)) score = Math.max(score, 650);
  if (serial.includes(normalizedQuery)) score = Math.max(score, 600);
  if (aliases.some((alias) => normalizeCode(alias.value).includes(normalizedQuery))) score = Math.max(score, 575);
  if (normalize(asset.name).includes(textQuery)) score = Math.max(score, 420);
  if (normalize(asset.model).includes(textQuery)) score = Math.max(score, 360);
  if (normalize(asset.brand).includes(textQuery)) score = Math.max(score, 320);
  if (normalize(asset.employee?.fullName).includes(textQuery) || normalize(asset.assignedTo).includes(textQuery)) score = Math.max(score, 240);
  if (normalize(asset.location).includes(textQuery) || normalize(asset.areaDepartment).includes(textQuery)) score = Math.max(score, 180);
  if (normalize(asset.ipAddress).includes(textQuery) || normalize(asset.macAddress).includes(textQuery)) score = Math.max(score, 160);

  return score;
}

export function isStrongInventorySearchMatch(asset: InventoryAsset, query?: string | null) {
  return inventorySearchScore(asset, query) >= 850;
}

export function sortInventorySearchResults<T extends InventoryAsset>(assets: T[], query?: string | null) {
  if (!normalize(query)) return assets;
  return [...assets].sort((a, b) => {
    const scoreDelta = inventorySearchScore(b, query) - inventorySearchScore(a, query);
    if (scoreDelta !== 0) return scoreDelta;
    return normalize(getSortableName(a)).localeCompare(normalize(getSortableName(b)));
  });
}

export function paginateInventory<T>(items: T[], pageInput?: string | number | null, pageSizeInput?: string | number | null) {
  const pageSize = clampNumber(pageSizeInput, 50, 25, 100);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(clampNumber(pageInput, 1, 1, Number.MAX_SAFE_INTEGER), totalPages);
  const startIndex = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    totalPages,
    totalItems: items.length,
    startNumber: items.length === 0 ? 0 : startIndex + 1,
    endNumber: Math.min(items.length, startIndex + pageSize),
    items: items.slice(startIndex, startIndex + pageSize),
  };
}

export function getInventoryReviewReasons(asset: InventoryAsset, signals: InventorySignals) {
  const reasons: string[] = [];
  const suspicious = signals.suspiciousNameIds.get(asset.id);
  if (suspicious) reasons.push(suspicious);
  if (!asset.assetTag) reasons.push("Missing asset tag.");
  if (!asset.serialNumber) reasons.push("Missing serial number.");
  if (!asset.model) reasons.push("Missing model.");
  if (signals.missingPhotoIds.has(asset.id)) reasons.push("Missing required photos.");
  if (signals.duplicateIpIds.has(asset.id)) reasons.push("Duplicate IP address.");
  if (isRetiredMobileWithNetworkData(asset)) reasons.push("Retired mobile asset still has IP/MAC.");
  if (signals.orphanLoanIds.has(asset.id)) reasons.push("Loaned out status without an active loan.");
  if (signals.suspiciousAssignmentIds.has(asset.id)) reasons.push("Assigned value looks like a legacy asset label.");
  if (mobilePairingStatus(asset) === "Needs Pair Review") reasons.push("Mobile/sled pairing needs review.");
  if (isStaticCandidate(asset) && !asset.ipAddress) reasons.push("Static/network candidate missing IP.");
  if (isFixedPhotoAsset(asset) && !asset.macAddress && ["ACCESS_POINT", "SWITCH", "CAMERA", "CAMERA_NVR", "NVR"].includes(asset.category)) reasons.push("Network infrastructure missing MAC.");
  return [...new Set(reasons)];
}

export function matchesInventoryView(asset: InventoryAsset, view: InventoryViewId, signals: InventorySignals) {
  if (view === "all") return true;
  if (view === "needs-review") return getInventoryReviewReasons(asset, signals).length > 0;
  if (view === "laptops") return ["LAPTOP", "DESKTOP"].includes(asset.category);
  if (view === "mobile") return mobileCategories.has(asset.category) || textIncludes(asset, ["ipod", "iphone", "ipad"]);
  if (view === "printers") return printerCategories.has(asset.category);
  if (view === "scales") return asset.category === "SCALE";
  if (view === "scanners") return scannerCategories.has(asset.category) || textIncludes(asset, ["scanner", "zebra base"]);
  if (view === "monitors") return asset.category === "MONITOR";
  if (view === "network") return Boolean(asset.ipAddress || asset.macAddress || isStaticCandidate(asset));
  if (view === "assigned") return isAssignedAsset(asset);
  if (view === "available") return ["AVAILABLE", "ACTIVE", "RESERVED"].includes(asset.status) && !isAssignedAsset(asset);
  if (view === "loaned") return isLoanedAsset(asset);
  if (view === "rma") return isRmaAsset(asset);
  if (view === "missing") return ["MISSING", "LOST"].includes(asset.status);
  if (view === "retired") return ["RETIRED", "DISPOSED"].includes(asset.status);
  if (view === "missing-photos") return signals.missingPhotoIds.has(asset.id);
  return true;
}

export function isLoanedAsset(asset: InventoryAsset) {
  return asset.status === "LOANED_OUT" || hasActiveLoan(asset);
}

export function isRmaAsset(asset: InventoryAsset) {
  return asset.status === "IN_REPAIR_RMA" || Boolean(asset.rmaItems?.some((item) => item.result === "PENDING" && ["SENT", "ACTIVE", "PARTIALLY_RETURNED"].includes(String(item.rmaCase?.status ?? ""))));
}

export function isStaticCandidate(asset: InventoryAsset) {
  return Boolean(asset.usesStaticIp || asset.isFixedAsset || asset.movementAlertsEnabled || networkCategories.has(asset.category));
}

function isAssignedAsset(asset: InventoryAsset) {
  return Boolean(asset.employee || (asset.assignedTo && !isAssetLikeAssignedValue(asset.assignedTo)) || asset.status === "IN_USE_ASSIGNED" || asset.assignmentItems?.some((item) => !item.returnedAt));
}

function hasActiveLoan(asset: InventoryAsset) {
  return Boolean(asset.assetLoanItems?.some((item) => !item.returnedAt && item.returnStatus === "PENDING" && ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"].includes(String(item.loan?.status ?? ""))));
}

function isRetiredMobileWithNetworkData(asset: InventoryAsset) {
  return ["RETIRED", "DISPOSED"].includes(asset.status) && mobileCategories.has(asset.category) && Boolean(asset.ipAddress || asset.macAddress || asset.usesStaticIp || asset.isFixedAsset || asset.movementAlertsEnabled);
}

function textIncludes(asset: InventoryAsset, values: string[]) {
  const text = normalize(`${asset.name} ${asset.model ?? ""} ${asset.assetTag ?? ""} ${asset.brand ?? ""}`);
  return values.some((value) => text.includes(value));
}

function getSortableName(asset: InventoryAsset) {
  return asset.assetTag || asset.name || asset.serialNumber || asset.id;
}

function clampNumber(value: string | number | null | undefined, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}
