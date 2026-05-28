import type { PrismaClient, ScheduledJobType } from "@prisma/client";
import { buildAllLocalAlertCandidates, alertCandidateKey, alertRecordKey, type AlertRefreshSummary } from "./alert-workflows";

type AlertRefreshScope = ScheduledJobType | "MANUAL";

function emptySummary(): AlertRefreshSummary {
  return { alertsCreated: 0, alertsUpdated: 0, alertsResolved: 0, alertsSkipped: 0, errors: [] };
}

function scopedSettings(settings: {
  enableConflictAlerts: boolean;
  enableLowStockAlerts: boolean;
  enablePrinterMaintenanceAlerts: boolean;
  enableWarrantyAlerts: boolean;
  warrantyAlertThresholdDays: number;
  enableMovementAlerts: boolean;
  enableMissingAssetSeenOnlineAlerts: boolean;
}, scope: AlertRefreshScope) {
  if (scope === "CONFLICT_DETECTION") {
    return { ...settings, enableLowStockAlerts: false, enablePrinterMaintenanceAlerts: false, enableWarrantyAlerts: false, enableMovementAlerts: false, enableMissingAssetSeenOnlineAlerts: false };
  }
  if (scope === "STOCK_ALERT_CHECK") {
    return { ...settings, enableConflictAlerts: false, enablePrinterMaintenanceAlerts: false, enableWarrantyAlerts: false, enableMovementAlerts: false, enableMissingAssetSeenOnlineAlerts: false };
  }
  if (scope === "WARRANTY_ALERT_CHECK") {
    return { ...settings, enableConflictAlerts: false, enableLowStockAlerts: false, enablePrinterMaintenanceAlerts: false, enableMovementAlerts: false, enableMissingAssetSeenOnlineAlerts: false };
  }
  if (scope === "PRINTER_MAINTENANCE_CHECK") {
    return { ...settings, enableConflictAlerts: false, enableLowStockAlerts: false, enableWarrantyAlerts: false, enableMovementAlerts: false, enableMissingAssetSeenOnlineAlerts: false };
  }
  if (scope === "MOVEMENT_ALERT_CHECK_EXISTING_DATA_ONLY") {
    return { ...settings, enableConflictAlerts: false, enableLowStockAlerts: false, enablePrinterMaintenanceAlerts: false, enableWarrantyAlerts: false };
  }
  return settings;
}

function activityActionForAlertType(type: string) {
  if (type === "FIXED_ASSET_MOVED") return "movement_alert.created";
  if (type === "MISSING_ASSET_SEEN_ONLINE") return "missing_asset_seen_online.created";
  if (type.includes("WARRANTY")) return "warranty_alert.created";
  return "alert.created";
}

export async function runAlertRefresh(prisma: PrismaClient, scope: AlertRefreshScope = "MANUAL", now = new Date()) {
  const summary = emptySummary();
  const settings = await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const [devices, stockItems, printerAssets, facturas, latestHistoriesRaw, snapshots, openAlerts] = await Promise.all([
    prisma.device.findMany({ include: { ipRange: true } }),
    prisma.stockItem.findMany({ where: { active: true } }),
    prisma.device.findMany({ where: { category: { in: ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"] } } }),
    prisma.factura.findMany(),
    prisma.assetLocationHistory.findMany({
      include: { apMapLocation: { include: { locationZone: true } } },
      orderBy: { seenAt: "desc" },
      take: 1000,
    }),
    prisma.unifiClientSnapshot.findMany({ where: { online: true }, orderBy: { syncedAt: "desc" }, take: 1000 }),
    prisma.alert.findMany({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
  ]);

  const seenHistoryAssets = new Set<string>();
  const latestHistories = latestHistoriesRaw.filter((history) => {
    if (seenHistoryAssets.has(history.assetId)) return false;
    seenHistoryAssets.add(history.assetId);
    return true;
  });

  const candidates = buildAllLocalAlertCandidates({
    devices,
    stockItems,
    printerAssets,
    facturas,
    latestHistories,
    snapshots,
    settings: scopedSettings(settings, scope),
    now,
  });

  const existingByKey = new Map(openAlerts.map((alert) => [alertRecordKey(alert), alert]));
  const candidateKeys = new Set(candidates.map(alertCandidateKey));

  for (const candidate of candidates) {
    const key = alertCandidateKey(candidate);
    const existing = existingByKey.get(key);
    if (existing && settings.alertDuplicateSuppressionEnabled) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: {
          source: candidate.source,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          metadata: candidate.metadata,
          lastSeenAt: now,
        },
      });
      await prisma.activityLog.create({
        data: { action: "alert.updated", entity: "alert", entityId: existing.id, message: `${candidate.title} was refreshed.` },
      });
      summary.alertsUpdated += 1;
    } else {
      const alert = await prisma.alert.create({
        data: {
          type: candidate.type,
          source: candidate.source,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          assetId: candidate.assetId,
          stockItemId: candidate.stockItemId,
          metadata: candidate.metadata,
        },
      });
      await prisma.activityLog.create({
        data: {
          action: activityActionForAlertType(candidate.type),
          entity: "alert",
          entityId: alert.id,
          message: candidate.title,
        },
      });
      summary.alertsCreated += 1;
    }
  }

  if (settings.autoResolveMovementAlerts && (scope === "MANUAL" || scope === "ALERT_REFRESH" || scope === "MOVEMENT_ALERT_CHECK_EXISTING_DATA_ONLY")) {
    const movementAlerts = openAlerts.filter((alert) => alert.type === "FIXED_ASSET_MOVED");
    for (const alert of movementAlerts) {
      if (candidateKeys.has(alertRecordKey(alert))) continue;
      await prisma.alert.update({
        where: { id: alert.id },
        data: { status: "RESOLVED", resolvedAt: now, resolutionNote: "Auto-resolved because the asset returned to the expected zone or no longer matches movement alert criteria." },
      });
      await prisma.activityLog.create({
        data: { action: "alert.resolved", entity: "alert", entityId: alert.id, message: `${alert.title} was auto-resolved.` },
      });
      summary.alertsResolved += 1;
    }
  }

  await prisma.activityLog.create({
    data: {
      action: "alerts.refreshed",
      entity: "alert",
      message: `Alert refresh completed: ${summary.alertsCreated} created, ${summary.alertsUpdated} updated, ${summary.alertsResolved} resolved.`,
      metadata: JSON.stringify({ ...summary, scope }),
    },
  });

  return summary;
}
