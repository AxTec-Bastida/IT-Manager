import type { Alert, AlertSeverity, AlertSource, AlertStatus, AlertType, AssetLocationHistory, Device, Factura, IpRange, LocationZone, StockItem, UnifiClientSnapshot } from "@prisma/client";
import { detectInventoryConflicts, type ConflictCandidate } from "./conflicts";
import { buildPrinterAlertCandidates, buildStockAlertCandidates } from "./maintenance-alerts";

export type AlertCandidate = {
  type: AlertType;
  source: AlertSource;
  severity: AlertSeverity;
  title: string;
  message: string;
  assetId?: string | null;
  stockItemId?: string | null;
  metadata?: string | null;
  duplicateKey?: string;
};

export type AlertRefreshSummary = {
  alertsCreated: number;
  alertsUpdated: number;
  alertsResolved: number;
  alertsSkipped: number;
  errors: string[];
};

export function alertCandidateKey(candidate: Pick<AlertCandidate, "type" | "assetId" | "stockItemId" | "duplicateKey">) {
  return candidate.duplicateKey ?? `${candidate.type}:${candidate.assetId ?? ""}:${candidate.stockItemId ?? ""}`;
}

export function alertRecordKey(alert: Pick<Alert, "type" | "assetId" | "stockItemId" | "metadata">) {
  const metadata = parseMetadata(alert.metadata);
  return typeof metadata.duplicateKey === "string" ? metadata.duplicateKey : `${alert.type}:${alert.assetId ?? ""}:${alert.stockItemId ?? ""}`;
}

export function alertCanTransition(from: AlertStatus, to: AlertStatus) {
  if (from === to) return true;
  if (from === "RESOLVED" || from === "IGNORED") return false;
  return ["OPEN", "ACKNOWLEDGED", "RESOLVED", "IGNORED"].includes(to);
}

function parseMetadata(metadata?: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function withDuplicateKey(candidate: AlertCandidate) {
  const duplicateKey = alertCandidateKey(candidate);
  const metadata = { ...parseMetadata(candidate.metadata), duplicateKey };
  return { ...candidate, metadata: JSON.stringify(metadata), duplicateKey };
}

export function dedupeCandidates(candidates: AlertCandidate[]) {
  const seen = new Set<string>();
  const deduped: AlertCandidate[] = [];
  for (const candidate of candidates.map(withDuplicateKey)) {
    if (seen.has(candidate.duplicateKey!)) continue;
    seen.add(candidate.duplicateKey!);
    deduped.push(candidate);
  }
  return deduped;
}

const conflictAlertTypeByType: Record<string, AlertType> = {
  DUPLICATE_IP: "CONFLICT_DUPLICATE_IP",
  DUPLICATE_MAC: "CONFLICT_DUPLICATE_MAC",
  OUTSIDE_RANGE: "CONFLICT_OUTSIDE_RANGE",
  VLAN_MISMATCH: "CONFLICT_VLAN_MISMATCH",
  UNKNOWN_ACTIVE_IP: "CONFLICT_UNKNOWN_ACTIVE_IP",
  ACTIVE_WHILE_AVAILABLE: "CONFLICT_ACTIVE_WHILE_AVAILABLE",
};

export function buildConflictAlertCandidates(conflicts: ConflictCandidate[]): AlertCandidate[] {
  return conflicts.map((conflict) => ({
    type: conflictAlertTypeByType[conflict.type] ?? "CONFLICT_DUPLICATE_IP",
    source: "IPAM",
    severity: conflict.severity,
    title: conflict.title,
    message: `${conflict.description} Suggested fix: ${conflict.suggestedFix}`,
    assetId: conflict.affectedDeviceIds?.[0] ?? null,
    metadata: JSON.stringify({
      conflictType: conflict.type,
      affectedDeviceIds: conflict.affectedDeviceIds ?? [],
      affectedIps: conflict.affectedIps ?? [],
      suggestedFix: conflict.suggestedFix,
    }),
    duplicateKey: `conflict:${conflict.type}:${[...(conflict.affectedDeviceIds ?? []), ...(conflict.affectedIps ?? [])].sort().join("|")}`,
  }));
}

export function daysUntil(date: Date, now = new Date()) {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildWarrantyAlertCandidates(
  assets: Array<Pick<Device, "id" | "name" | "assetTag" | "warrantyExpiresAt">>,
  facturas: Array<Pick<Factura, "id" | "facturaNumber" | "vendorName" | "warrantyEndAt">>,
  thresholdDays: number,
  now = new Date(),
): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  for (const asset of assets) {
    if (!asset.warrantyExpiresAt) continue;
    const days = daysUntil(asset.warrantyExpiresAt, now);
    if (days >= 0 && days <= thresholdDays) {
      candidates.push({
        type: "WARRANTY_EXPIRING",
        source: "WARRANTY",
        severity: days <= 14 ? "HIGH" : "MEDIUM",
        title: "Warranty expiring soon",
        message: `${asset.name}${asset.assetTag ? ` asset ${asset.assetTag}` : ""} warranty expires in ${days} days.`,
        assetId: asset.id,
        metadata: JSON.stringify({ expiresAt: asset.warrantyExpiresAt.toISOString(), days }),
      });
    }
  }
  for (const factura of facturas) {
    if (!factura.warrantyEndAt) continue;
    const days = daysUntil(factura.warrantyEndAt, now);
    if (days >= 0 && days <= thresholdDays) {
      candidates.push({
        type: "FACTURA_WARRANTY_EXPIRING",
        source: "FACTURA",
        severity: days <= 14 ? "HIGH" : "MEDIUM",
        title: "Factura warranty expiring soon",
        message: `${factura.facturaNumber} from ${factura.vendorName} warranty expires in ${days} days.`,
        metadata: JSON.stringify({ facturaId: factura.id, expiresAt: factura.warrantyEndAt.toISOString(), days }),
        duplicateKey: `factura-warranty:${factura.id}`,
      });
    }
  }
  return candidates;
}

export type MovementAsset = Pick<Device, "id" | "name" | "category" | "status" | "isFixedAsset" | "usesStaticIp" | "expectedLocationZoneId" | "movementAlertsEnabled" | "allowedZoneDistance">;
export type MovementHistory = Pick<AssetLocationHistory, "assetId" | "apName" | "apMac" | "locationLabel" | "seenAt"> & {
  apMapLocation?: { locationZoneId: string | null; locationZone?: Pick<LocationZone, "id" | "name"> | null } | null;
};

const mobileStatuses = new Set(["LOANED_OUT"]);
const mobileCategories = new Set(["SCANNER", "SLED", "LAPTOP", "PHONE", "IPOD", "IPHONE", "IPAD", "TABLET"]);

export function shouldEvaluateMovement(asset: MovementAsset) {
  return Boolean(
    asset.movementAlertsEnabled &&
      (asset.isFixedAsset || asset.usesStaticIp) &&
      asset.expectedLocationZoneId &&
      !mobileStatuses.has(asset.status) &&
      !mobileCategories.has(asset.category),
  );
}

export function buildMovementAlertCandidates(assets: MovementAsset[], latestHistories: MovementHistory[]): AlertCandidate[] {
  const latestByAsset = new Map(latestHistories.map((history) => [history.assetId, history]));
  const candidates: AlertCandidate[] = [];
  for (const asset of assets) {
    if (!shouldEvaluateMovement(asset)) continue;
    const history = latestByAsset.get(asset.id);
    const actualZoneId = history?.apMapLocation?.locationZoneId;
    if (!history || !actualZoneId || actualZoneId === asset.expectedLocationZoneId) continue;
    const actualZoneName = history.apMapLocation?.locationZone?.name ?? "Unmapped zone";
    candidates.push({
      type: "FIXED_ASSET_MOVED",
      source: "MOVEMENT",
      severity: "HIGH",
      title: "Fixed asset may have moved from expected area",
      message: `${asset.name} was last seen at ${actualZoneName} on ${history.apName}, outside its expected zone.`,
      assetId: asset.id,
      metadata: JSON.stringify({
        expectedZoneId: asset.expectedLocationZoneId,
        actualZoneId,
        actualZoneName,
        apName: history.apName,
        apMac: history.apMac,
        seenAt: history.seenAt.toISOString(),
      }),
      duplicateKey: `movement:${asset.id}:${actualZoneId}`,
    });
  }
  return candidates;
}

export function buildMissingAssetOnlineCandidates(
  assets: Array<Pick<Device, "id" | "name" | "status">>,
  snapshots: Array<Pick<UnifiClientSnapshot, "assetId" | "online" | "apName" | "apMac" | "lastSeenAt" | "syncedAt">>,
): AlertCandidate[] {
  const missingIds = new Set(assets.filter((asset) => asset.status === "MISSING").map((asset) => asset.id));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return snapshots
    .filter((snapshot) => snapshot.assetId && snapshot.online && missingIds.has(snapshot.assetId))
    .map((snapshot) => {
      const asset = assetById.get(snapshot.assetId!)!;
      return {
        type: "MISSING_ASSET_SEEN_ONLINE" as AlertType,
        source: "MISSING_ASSET" as AlertSource,
        severity: "HIGH" as AlertSeverity,
        title: "Missing asset seen online",
        message: `${asset.name} is marked missing but was seen online${snapshot.apName ? ` on ${snapshot.apName}` : ""}.`,
        assetId: asset.id,
        metadata: JSON.stringify({ apName: snapshot.apName, apMac: snapshot.apMac, seenAt: (snapshot.lastSeenAt ?? snapshot.syncedAt)?.toISOString() }),
      };
    });
}

export function buildAllLocalAlertCandidates(input: {
  devices: Array<Device & { ipRange?: IpRange | null }>;
  stockItems: StockItem[];
  printerAssets: Device[];
  facturas: Factura[];
  latestHistories: MovementHistory[];
  snapshots: UnifiClientSnapshot[];
  settings: {
    enableConflictAlerts: boolean;
    enableLowStockAlerts: boolean;
    enablePrinterMaintenanceAlerts: boolean;
    enableWarrantyAlerts: boolean;
    warrantyAlertThresholdDays: number;
    enableMovementAlerts: boolean;
    enableMissingAssetSeenOnlineAlerts: boolean;
  };
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return dedupeCandidates([
    ...(input.settings.enableLowStockAlerts ? buildStockAlertCandidates(input.stockItems).map((candidate) => ({ ...candidate, source: candidate.source ?? "STOCK" })) : []),
    ...(input.settings.enablePrinterMaintenanceAlerts ? buildPrinterAlertCandidates(input.printerAssets, now).map((candidate) => ({ ...candidate, source: candidate.source ?? "PRINTER" })) : []),
    ...(input.settings.enableConflictAlerts ? buildConflictAlertCandidates(detectInventoryConflicts(input.devices as Array<Device & { ipRange: IpRange | null }>)) : []),
    ...(input.settings.enableWarrantyAlerts ? buildWarrantyAlertCandidates(input.devices, input.facturas, input.settings.warrantyAlertThresholdDays, now) : []),
    ...(input.settings.enableMovementAlerts ? buildMovementAlertCandidates(input.devices, input.latestHistories) : []),
    ...(input.settings.enableMissingAssetSeenOnlineAlerts ? buildMissingAssetOnlineCandidates(input.devices, input.snapshots) : []),
  ] as AlertCandidate[]);
}
