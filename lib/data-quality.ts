import { prisma } from "@/lib/prisma";
import type { MaintenanceResult, MaintenanceType } from "@prisma/client";
import { matchLegacyColumn } from "@/lib/legacy-import";
import { normalizeMacAddress, validateIPv4 } from "@/lib/ip";
import { buildMobilePairingCleanupPlan } from "@/lib/mobile-legacy";
import { buildPhotoChecklist, isFixedPhotoAsset, requiredPhotoLabels, type RequiredPhotoType } from "@/lib/photo-compliance";
import { RECOMMENDED_PHOTO_BYTES } from "@/lib/photo-storage";
import { suggestStockCategory } from "@/lib/stock-classification";
import { isGenericPeripheralLikeDevice, stockRecordLooksSerialized } from "@/lib/item-workflow-classification";
import { getAssetDisplayName, isSledAsset } from "@/lib/asset-display";
import { isPhysicalLabelAliasType, normalizedAliasCompare } from "@/lib/label-aliases";
import { summarizeMaintenanceReview } from "@/lib/maintenance";
import { buildAssetValueSummary } from "@/lib/depreciation";
import { isBitLockerEligibleCategory, validateVaultSecret } from "@/lib/bitlocker-vault";
import { getOfflineConflictHealth } from "@/lib/offline-conflicts";

type ReviewDevice = {
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
  usesStaticIp: boolean;
  isFixedAsset: boolean;
  movementAlertsEnabled: boolean;
  expectedLocationZoneId?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  employee?: { fullName: string; employeeId: string | null } | null;
  photos?: Array<{ id?: string; photoType: string; isPrimary?: boolean | null; sizeBytes?: number | null; fileSize?: number | null; thumbnailPath?: string | null; mimeType?: string | null }>;
  rmaItems?: Array<{ result?: string | null; returnedAt?: Date | string | null }>;
  assignmentItems?: Array<{ returnedAt?: Date | string | null }>;
  assetLoanItems?: Array<{ returnedAt?: Date | string | null }>;
  facturaLineItemLinks?: Array<{ id: string; lineItem: { id: string; description: string; quantity: number; factura: { id: string; facturaNumber: string; vendorName: string } } }>;
  aliases?: Array<{ aliasType: string; value: string }>;
  sourceRelationships?: Array<{ relationshipType: string; status: string; targetDeviceId: string }>;
  targetRelationships?: Array<{ relationshipType: string; status: string; sourceDeviceId: string }>;
  maintenanceDueAt?: Date | string | null;
  lastCleanedAt?: Date | string | null;
  cleaningIntervalDays?: number | null;
  maintenanceRecords?: Array<{ id: string; maintenanceType: MaintenanceType; result: MaintenanceResult; performedAt: Date | string; nextDueAt?: Date | string | null; notes?: string | null }>;
  purchaseDate?: Date | null;
  warrantyExpiresAt?: Date | null;
  facturaId?: string | null;
  valueProfile?: {
    purchaseValue: number | null;
    currency: string;
    purchaseDate: Date | null;
    usefulLifeMonths: number | null;
    residualPercent: number;
    residualValue: number | null;
    currentEstimatedValue: number | null;
    lastCalculatedAt: Date | null;
    sourceType?: string | null;
    sourceFacturaLineItemAssetId?: string | null;
  } | null;
  bitLockerRecoveryKey?: {
    id: string;
    keyId?: string | null;
    volumeLabel?: string | null;
    protectorId?: string | null;
    source?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    lastViewedAt?: Date | string | null;
    lastViewedByName?: string | null;
  } | null;
};

type ReviewFactura = {
  id: string;
  facturaNumber: string;
  vendorName: string;
  purchaseDate: Date | null;
  receivedDate: Date | null;
  notes: string | null;
  originalFilename?: string | null;
  filePath?: string | null;
  xmlPath?: string | null;
  xmlOriginalName?: string | null;
  xmlUuid?: string | null;
  xmlSerie?: string | null;
  xmlFolio?: string | null;
  xmlCurrency?: string | null;
  xmlTotal?: number | null;
  assets?: unknown[];
  stockItems?: unknown[];
  lineItems?: Array<{ id: string; description: string; quantity: number; unitCost: number; currency: string; assetLinks: Array<{ id: string; deviceId: string; device?: ReviewDevice }> }>;
  extractionAttempts?: Array<{ id: string; status: string; candidateCount: number; createdLineItemCount: number; warningsJson: string | null; createdAt: Date | string }>;
};

type ReviewStockItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  itemType?: string | null;
  quantityOnHand: number;
  minimumQuantity: number;
  vendorName?: string | null;
  storageLocation: string | null;
  facturaId: string | null;
  active?: boolean;
  notes?: string | null;
  _count?: {
    movements?: number;
    maintenanceRecords?: number;
    stockIssues?: number;
    purchaseNoteItems?: number;
  };
  stockIssues?: Array<{ status: string }>;
  photos?: Array<{ id: string }>;
};

type ReviewImportRun = {
  id: string;
  fileName: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  summaryJson: string | null;
  rowErrors?: Array<{ sheetName: string; rowNumber: number; errorType: string; message: string; rawJson: string | null }>;
};

const nonRetiredStatuses = new Set(["ACTIVE", "RESERVED", "AVAILABLE", "IN_USE_ASSIGNED", "LOANED_OUT", "IN_REPAIR_RMA", "MISSING"]);
const staticCategories = new Set(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "DESKTOP", "CAMERA", "CAMERA_NVR", "NVR", "SWITCH", "ACCESS_POINT"]);
const printerCategories = new Set(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"]);

export function findDuplicateIps(devices: ReviewDevice[]) {
  const groups = new Map<string, ReviewDevice[]>();
  for (const device of devices) {
    if (!device.ipAddress || !nonRetiredStatuses.has(device.status)) continue;
    groups.set(device.ipAddress, [...(groups.get(device.ipAddress) ?? []), device]);
  }
  return [...groups.entries()]
    .filter(([, assets]) => assets.length > 1)
    .map(([ipAddress, assets]) => ({ ipAddress, count: assets.length, assets }))
    .sort((a, b) => b.count - a.count || a.ipAddress.localeCompare(b.ipAddress));
}

export function findDuplicateMacs(devices: ReviewDevice[]) {
  const groups = new Map<string, ReviewDevice[]>();
  for (const device of devices) {
    const macAddress = normalizeMacAddress(device.macAddress);
    if (!macAddress || !nonRetiredStatuses.has(device.status)) continue;
    groups.set(macAddress, [...(groups.get(macAddress) ?? []), device]);
  }
  return [...groups.entries()]
    .filter(([, assets]) => assets.length > 1)
    .map(([macAddress, assets]) => ({ macAddress, count: assets.length, assets }))
    .sort((a, b) => b.count - a.count || a.macAddress.localeCompare(b.macAddress));
}

export function findUnlinkedFacturas(facturas: ReviewFactura[]) {
  return facturas.filter((factura) => (factura.assets?.length ?? 0) === 0 && (factura.stockItems?.length ?? 0) === 0);
}

export function summarizeMissingFields(devices: ReviewDevice[]) {
  return {
    missingAssetTag: devices.filter((device) => !device.assetTag),
    missingSerial: devices.filter((device) => !device.serialNumber),
    missingModel: devices.filter((device) => !device.model),
    missingLocation: devices.filter((device) => !device.location && !device.areaDepartment),
    missingStatusOrCondition: [],
  };
}

export function summarizeMobileAssets(devices: ReviewDevice[]) {
  const mobile = devices.filter((device) => isMobileAppleReviewAsset(device));
  const violations = mobile.filter((device) => device.ipAddress || device.usesStaticIp || device.isFixedAsset || device.movementAlertsEnabled);
  return {
    total: mobile.length,
    iPods: mobile.filter((device) => includesText(device, "ipod")).length,
    iPhones: mobile.filter((device) => includesText(device, "iphone")).length,
    iPads: mobile.filter((device) => includesText(device, "ipad")).length,
    phones: mobile.filter((device) => device.category === "PHONE").length,
    tablets: mobile.filter((device) => device.category === "TABLET").length,
    networkTrackingEnabled: mobile.filter((device) => device.usesStaticIp || device.isFixedAsset || device.movementAlertsEnabled).length,
    withIp: mobile.filter((device) => device.ipAddress).length,
    violations,
  };
}

export function summarizeStaticAssets(devices: ReviewDevice[]) {
  const staticAssets = devices.filter((device) => staticCategories.has(device.category));
  const scales = devices.filter((device) => device.category === "SCALE");
  const printers = devices.filter((device) => printerCategories.has(device.category));
  const byCategory = Object.fromEntries([...staticCategories].map((category) => [category, staticAssets.filter((device) => device.category === category).length]));

  return {
    total: staticAssets.length,
    byCategory,
    withIp: staticAssets.filter((device) => device.ipAddress).length,
    withMac: staticAssets.filter((device) => device.macAddress).length,
    missingIp: staticAssets.filter((device) => !device.ipAddress),
    missingMac: staticAssets.filter((device) => !device.macAddress),
    missingLocation: staticAssets.filter((device) => !device.location && !device.areaDepartment),
    activeMissingLocation: devices.filter((device) => ["ACTIVE", "AVAILABLE", "RESERVED"].includes(device.status) && !device.location && !device.areaDepartment),
    staticIpMissingLocation: devices.filter((device) => (device.usesStaticIp || device.isFixedAsset || device.ipAddress) && !device.location && !device.areaDepartment),
    markedStatic: staticAssets.filter((device) => device.usesStaticIp || device.isFixedAsset).length,
    withExpectedLocation: staticAssets.filter((device) => device.location || device.areaDepartment || device.expectedLocationZoneId).length,
    invalidIps: staticAssets.filter((device) => device.ipAddress && !validateIPv4(device.ipAddress).ok),
    scales: {
      total: scales.length,
      withIp: scales.filter((device) => device.ipAddress).length,
      withMac: scales.filter((device) => device.macAddress).length,
      markedStatic: scales.filter((device) => device.usesStaticIp || device.isFixedAsset).length,
      missingIp: scales.filter((device) => !device.ipAddress),
      missingMac: scales.filter((device) => !device.macAddress),
      assets: scales,
    },
    printers: {
      total: printers.length,
      mfp: printers.filter((device) => device.category === "MFP_PRINTER").length,
      thermal: printers.filter((device) => device.category === "THERMAL_PRINTER").length,
      withIp: printers.filter((device) => device.ipAddress).length,
      missingIp: printers.filter((device) => !device.ipAddress),
      missingMaintenanceSettings: printers.filter((device) => !device.isFixedAsset && !device.usesStaticIp),
    },
  };
}

export function summarizeStockReview(stockItems: ReviewStockItem[]) {
  const categorySuggestions = stockItems.flatMap((item) => {
      const suggestion = suggestStockCategory(item);
      return suggestion && suggestion.category !== item.category ? [{ ...item, suggestedCategory: suggestion.category, suggestionReason: suggestion.reason }] : [];
    });

  return {
    total: stockItems.length,
    byCategory: stockItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {}),
    quantityZero: stockItems.filter((item) => item.quantityOnHand === 0),
    belowMinimum: stockItems.filter((item) => item.quantityOnHand <= item.minimumQuantity),
    missingSku: stockItems.filter((item) => !item.sku),
    missingStorageLocation: stockItems.filter((item) => !item.storageLocation),
    linkedToFacturas: stockItems.filter((item) => item.facturaId),
    notLinkedToFacturas: stockItems.filter((item) => !item.facturaId),
    categoryOther: stockItems.filter((item) => item.category === "OTHER"),
    noMovementHistory: stockItems.filter((item) => (item._count?.movements ?? 0) === 0),
    categorySuggestions,
  };
}

export function summarizeStockVsAssetClassification(devices: ReviewDevice[], stockItems: ReviewStockItem[]) {
  return {
    genericPeripheralDevices: devices
      .filter(isGenericPeripheralLikeDevice)
      .map((asset) => ({
        ...asset,
        reason: asset.category === "OTHER" ? "Generic peripheral/imported accessory is stored as a serialized Device." : "Device name/model looks like generic stock or peripheral.",
      })),
    serializedLookingStock: stockItems
      .filter(stockRecordLooksSerialized)
      .map((item) => ({
        ...item,
        reason: "Stock item name looks like serialized equipment. Confirm this should be quantity stock.",
      })),
    stockMissingUsefulType: stockItems.filter((item) => item.category === "OTHER" || !item.itemType),
  };
}

export function summarizeAssetValueQuality(devices: ReviewDevice[], now = new Date()) {
  const trackedAssets = devices.filter((device) => !["RETIRED", "DISPOSED"].includes(device.status));
  const withProfile = trackedAssets.filter((device) => Boolean(device.valueProfile));
  const missingPurchaseValue = trackedAssets.filter((device) => !device.valueProfile?.purchaseValue);
  const missingPurchaseDate = trackedAssets.filter((device) => device.valueProfile?.purchaseValue && !(device.valueProfile.purchaseDate ?? device.purchaseDate));
  const staleEstimate = trackedAssets.filter((device) => {
    const lastCalculatedAt = normalizeDateValue(device.valueProfile?.lastCalculatedAt);
    if (!device.valueProfile?.purchaseValue || !lastCalculatedAt) return false;
    return now.getTime() - lastCalculatedAt.getTime() > 1000 * 60 * 60 * 24 * 35;
  });
  const reviewRows = trackedAssets
    .filter((device) => !device.valueProfile?.purchaseValue || (device.valueProfile?.purchaseValue && !(device.valueProfile.purchaseDate ?? device.purchaseDate)) || staleEstimate.includes(device))
    .map((device) => {
      const summary = buildAssetValueSummary(device, now);
      const reasons = [
        !device.valueProfile?.purchaseValue ? "Missing purchase value" : "",
        device.valueProfile?.purchaseValue && !(device.valueProfile.purchaseDate ?? device.purchaseDate) ? "Missing purchase date" : "",
        staleEstimate.includes(device) ? "Estimate older than 35 days" : "",
      ].filter(Boolean);
      return {
        ...device,
        reason: reasons.join("; "),
        currentEstimatedValue: summary.currentEstimatedValue,
        currency: device.valueProfile?.currency ?? "MXN",
      };
    });

  return {
    totalTracked: trackedAssets.length,
    withProfile,
    missingPurchaseValue,
    missingPurchaseDate,
    staleEstimate,
    reviewRows,
  };
}

export function summarizeBitLockerQuality(devices: ReviewDevice[], secretStatus = validateVaultSecret()) {
  const eligible = devices.filter((device) => isBitLockerEligibleCategory(device.category));
  const activeEligible = eligible.filter((device) => !["RETIRED", "DISPOSED"].includes(device.status));
  const withKey = eligible.filter((device) => Boolean(device.bitLockerRecoveryKey));
  const missingKey = activeEligible.filter((device) => !device.bitLockerRecoveryKey);
  const retiredWithKey = eligible.filter((device) => ["RETIRED", "DISPOSED"].includes(device.status) && device.bitLockerRecoveryKey);
  const missingMetadata = withKey.filter((device) => !device.bitLockerRecoveryKey?.keyId || !device.bitLockerRecoveryKey?.protectorId || !device.bitLockerRecoveryKey?.volumeLabel);
  return {
    eligible,
    withKey,
    missingKey,
    retiredWithKey,
    missingMetadata,
    secretConfigured: secretStatus.configured,
    secretUsable: secretStatus.usable,
    secretTooShort: secretStatus.tooShort,
    secretWarning: withKey.length > 0 && !secretStatus.usable,
  };
}

export function summarizeFacturaLineItemQuality(facturas: ReviewFactura[], devices: ReviewDevice[]) {
  const lineItems = facturas.flatMap((factura) => (factura.lineItems ?? []).map((lineItem) => ({ ...lineItem, factura })));
  const facturasWithNoLineItems = facturas.filter((factura) => (factura.lineItems?.length ?? 0) === 0);
  const facturasWithAttachmentNoLineItems = facturasWithNoLineItems.filter((factura) => Boolean(factura.filePath || factura.originalFilename || factura.xmlPath || factura.xmlOriginalName));
  const facturasWithXmlNoLineItems = facturasWithNoLineItems.filter((factura) => Boolean(factura.xmlPath || factura.xmlOriginalName));
  const extractionAttemptedNoLineItems = facturasWithNoLineItems.filter((factura) => (factura.extractionAttempts?.length ?? 0) > 0);
  const xmlExtractionAttemptedNoLineItems = facturasWithNoLineItems.filter((factura) => (factura.extractionAttempts ?? []).some((attempt) => attempt.status.startsWith("XML_")));
  const noTextExtractionAttempts = facturas.filter((factura) => (factura.extractionAttempts ?? []).some((attempt) => ["NO_TEXT", "FAILED"].includes(attempt.status)));
  const lowConfidenceExtractionAttempts = facturas.filter((factura) => (factura.extractionAttempts ?? []).some((attempt) => attempt.status === "SUCCESS" && attempt.candidateCount > 0 && attempt.createdLineItemCount === 0));
  const xmlTotalMismatches = facturas
    .filter((factura) => factura.xmlTotal != null && (factura.lineItems?.length ?? 0) > 0)
    .map((factura) => {
      const lineItemTotal = (factura.lineItems ?? []).reduce((sum, lineItem) => sum + lineItem.quantity * lineItem.unitCost, 0);
      return { ...factura, lineItemTotal: Math.round(lineItemTotal * 100) / 100, xmlTotal: factura.xmlTotal ?? 0 };
    })
    .filter((factura) => Math.abs(factura.lineItemTotal - factura.xmlTotal) > 0.05);
  const lineItemsWithUnlinkedQuantity = lineItems
    .map((lineItem) => ({ ...lineItem, linkedCount: lineItem.assetLinks.length, unlinkedQuantity: Math.max(0, lineItem.quantity - lineItem.assetLinks.length) }))
    .filter((lineItem) => lineItem.unlinkedQuantity > 0);
  const lineItemsOverLinked = lineItems
    .map((lineItem) => ({ ...lineItem, linkedCount: lineItem.assetLinks.length, overLinkedBy: Math.max(0, lineItem.assetLinks.length - lineItem.quantity) }))
    .filter((lineItem) => lineItem.overLinkedBy > 0);
  const linkedAssetsMissingValue = devices.filter((device) => (device.facturaLineItemLinks?.length ?? 0) > 0 && !device.valueProfile?.purchaseValue);
  const assetsWithValueNoFacturaSource = devices.filter((device) => device.valueProfile?.purchaseValue && device.valueProfile.sourceType !== "FACTURA_LINE_ITEM");
  const assetsLinkedToMultipleLineItems = devices.filter((device) => (device.facturaLineItemLinks?.length ?? 0) > 1);

  return {
    totalLineItems: lineItems.length,
    facturasWithNoLineItems,
    facturasWithAttachmentNoLineItems,
    facturasWithXmlNoLineItems,
    extractionAttemptedNoLineItems,
    xmlExtractionAttemptedNoLineItems,
    noTextExtractionAttempts,
    lowConfidenceExtractionAttempts,
    xmlTotalMismatches,
    lineItemsWithUnlinkedQuantity,
    lineItemsOverLinked,
    linkedAssetsMissingValue,
    assetsWithValueNoFacturaSource,
    assetsLinkedToMultipleLineItems,
  };
}

const suspiciousStockStarts = ["falta crear", "pendiente", "crear", "revisar", "todo", "need to create", "missing create", "to create"];
const suspiciousStockContains = ["comentarios", "comment"];

export function detectSuspiciousStockComments(stockItems: ReviewStockItem[]) {
  return stockItems
    .map((item) => {
      const signal = suspiciousStockReason(item);
      return signal ? { ...item, reason: signal, source: sourceFromNotes(item.notes), canArchive: canArchiveSuspiciousStock(item) } : null;
    })
    .filter((item): item is ReviewStockItem & { reason: string; source: SourceReference | null; canArchive: boolean } => Boolean(item));
}

export function canArchiveSuspiciousStock(item: ReviewStockItem) {
  const activeIssueCount = item.stockIssues?.filter((issue) => ["ACTIVE", "PARTIALLY_RETURNED"].includes(issue.status)).length ?? 0;
  return Boolean(
    item.active !== false &&
      item.quantityOnHand === 0 &&
      !item.sku &&
      !item.vendorName &&
      !item.storageLocation &&
      !item.facturaId &&
      (item._count?.movements ?? 0) === 0 &&
      (item._count?.maintenanceRecords ?? 0) === 0 &&
      activeIssueCount === 0 &&
      (item._count?.purchaseNoteItems ?? 0) === 0,
  );
}

export function isCommentLikeLegacyStockRow(input: {
  name: string;
  quantity?: number | null;
  sku?: string | null;
  vendorName?: string | null;
  storageLocation?: string | null;
  serialNumber?: string | null;
  facturaNumber?: string | null;
}) {
  const name = normalizeText(input.name);
  if (!name) return false;
  const startsLikeComment = suspiciousStockStarts.some((pattern) => name.startsWith(pattern));
  const exactComment = suspiciousStockContains.some((pattern) => name === pattern || name.startsWith(`${pattern} `));
  if (!startsLikeComment && !exactComment) return false;
  return !input.quantity && !input.sku && !input.vendorName && !input.storageLocation && !input.serialNumber && !input.facturaNumber;
}

export function detectSuspiciousAssetNames(devices: ReviewDevice[]) {
  return devices
    .map((asset) => {
      const reason = suspiciousAssetNameReason(asset);
      return reason
        ? {
            ...asset,
            reason,
            suggestedName: suggestedAssetName(asset),
            source: sourceFromNotes(asset.notes),
          }
        : null;
    })
    .filter((asset): asset is ReviewDevice & { reason: string; suggestedName: string; source: SourceReference | null } => Boolean(asset));
}

export function findPhysicalLabelAliasConflicts(devices: ReviewDevice[]) {
  const groups = new Map<string, Array<{ device: ReviewDevice; aliasType: string; value: string }>>();
  for (const device of devices) {
    for (const alias of device.aliases ?? []) {
      if (!isPhysicalLabelAliasType(alias.aliasType)) continue;
      const key = normalizedAliasCompare(alias.value);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), { device, aliasType: alias.aliasType, value: alias.value }]);
    }
  }

  return [...groups.entries()]
    .filter(([, aliases]) => new Set(aliases.map((alias) => alias.device.id)).size > 1)
    .map(([normalizedValue, aliases]) => ({ normalizedValue, count: aliases.length, aliases }))
    .sort((a, b) => b.count - a.count || a.normalizedValue.localeCompare(b.normalizedValue));
}

export function findSledDisplayReview(devices: ReviewDevice[]) {
  return devices
    .filter((device) => isSledAsset(device) && (device.category === "OTHER" || normalizeText(device.name).startsWith("other ")))
    .map((device) => ({
      ...device,
      reason: device.category === "OTHER" ? "Sled asset is stored in the generic Other category because no dedicated Sled category exists yet." : "Sled display name still looks generic.",
      suggestedCategoryLabel: "Sled",
      suggestedDisplayName: getAssetDisplayName(device),
      source: sourceFromNotes(device.notes),
    }));
}

export function suggestedAssetName(asset: Pick<ReviewDevice, "brand" | "model" | "category" | "assetTag" | "serialNumber">) {
  const brand = cleanJoinToken(asset.brand);
  const model = cleanJoinToken(asset.model);
  const brandModel = [brand, model].filter(Boolean).join(" ").trim();
  if (brandModel) return brandModel;
  return [String(asset.category).replaceAll("_", " "), asset.assetTag || asset.serialNumber].filter(Boolean).join(" ").trim();
}

export function summarizePhotoCompliance(devices: ReviewDevice[]) {
  const assets = devices.map((asset) => {
    const checklist = buildPhotoChecklist(asset);
    return { ...asset, checklist, source: sourceFromNotes(asset.notes) };
  });
  const missingRequired = assets.filter((asset) => asset.checklist.missing.length > 0);
  const missingByType = (type: RequiredPhotoType) => assets.filter((asset) => asset.checklist.missing.includes(type));
  const fixedMissingLocation = assets.filter((asset) => isFixedPhotoAsset(asset) && asset.checklist.missing.includes("LOCATION_INSTALLED"));
  const rmaRepairMissingCondition = assets.filter((asset) => ["IN_REPAIR_RMA", "MISSING", "LOST"].includes(asset.status) && (asset.checklist.missing.includes("DAMAGE") || asset.checklist.missing.includes("RMA_CONDITION")));
  const photosMissingThumbnails = assets.flatMap((asset) =>
    (asset.photos ?? [])
      .filter((photo) => photo.mimeType?.startsWith("image/") && !photo.thumbnailPath)
      .map((photo) => ({ asset, photo })),
  );
  const oversizedPhotos = assets.flatMap((asset) =>
    (asset.photos ?? [])
      .filter((photo) => Number(photo.sizeBytes ?? photo.fileSize ?? 0) > RECOMMENDED_PHOTO_BYTES)
      .map((photo) => ({ asset, photo, sizeBytes: Number(photo.sizeBytes ?? photo.fileSize ?? 0) })),
  );

  return {
    totalAssets: assets.length,
    assetsWithNoPhotos: assets.filter((asset) => asset.checklist.hasNoPhotos),
    missingOverview: missingByType("OVERVIEW"),
    missingAssetTag: missingByType("ASSET_TAG"),
    missingSerialLabel: missingByType("SERIAL_LABEL"),
    missingCondition: missingByType("CONDITION"),
    fixedMissingLocation,
    rmaRepairMissingCondition,
    photosMissingThumbnails,
    oversizedPhotos,
    missingRequired,
  };
}

export function summarizeMapHealth(
  maps: Array<{ id: string; name: string; imageUrl: string; active: boolean; uploadedStoredFilename?: string | null; uploadedMimeType?: string | null }>,
  anchors: Array<{ id: string; apName: string; locationLabel: string; mapId?: string | null; active: boolean; displayPath?: string | null }>,
) {
  return {
    totalMaps: maps.length,
    uploadedMaps: maps.filter((map) => Boolean(map.uploadedStoredFilename)),
    manualPathMaps: maps.filter((map) => !map.uploadedStoredFilename),
    activeMapsMissingUpload: maps.filter((map) => map.active && !map.uploadedStoredFilename && !map.imageUrl.startsWith("/uploads/maps/")),
    totalAnchors: anchors.length,
    activeAnchors: anchors.filter((anchor) => anchor.active),
    anchorsWithoutMap: anchors.filter((anchor) => anchor.active && !anchor.mapId),
    inactiveAnchors: anchors.filter((anchor) => !anchor.active),
  };
}

export function parseSkippedDuplicateRows(rowErrors: NonNullable<ReviewImportRun["rowErrors"]> = []) {
  return rowErrors
    .filter((row) => row.message.toLowerCase().includes("duplicate") && row.message.toLowerCase().includes("skipped"))
    .map((row) => {
      const raw = parseRawJson(row.rawJson);
      return {
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        message: row.message,
        duplicateType: row.message.includes("serialNumber") ? "serialNumber" : row.message.includes("assetTag") ? "assetTag" : "unknown",
        duplicateKey: legacyRawValue(raw, row.message.includes("serialNumber") ? "serialNumber" : "assetTag"),
        firstSeenAt: row.message.match(/first seen at (.*?)\./)?.[1] ?? "",
        raw,
      };
    });
}

export function summarizeImportRun(run: ReviewImportRun | null, backupRoot?: string | null) {
  if (!run) return null;
  const summary = parseRawJson(run.summaryJson) as Record<string, unknown>;
  const skippedDuplicates = parseSkippedDuplicateRows(run.rowErrors);
  return {
    id: run.id,
    fileName: run.fileName,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    summary,
    warningCount: run.rowErrors?.filter((row) => row.errorType === "WARNING").length ?? 0,
    errorCount: run.rowErrors?.filter((row) => row.errorType === "ERROR").length ?? 0,
    duplicateCount: skippedDuplicates.length,
    redactionCount: run.rowErrors?.filter((row) => row.message.toLowerCase().includes("credential redacted")).length ?? 0,
    skippedDuplicates,
    auditFiles: findAuditFiles(backupRoot),
    backupRoot,
  };
}

export async function getDataQualityReview() {
  const latestRun = await prisma.importRun.findFirst({ orderBy: { startedAt: "desc" }, include: { rowErrors: true } });
  const [devices, facturas, stockItems, maps, mapAnchors] = await Promise.all([
    prisma.device.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        assetTag: true,
        serialNumber: true,
        category: true,
        status: true,
        condition: true,
        brand: true,
        model: true,
        location: true,
        areaDepartment: true,
        ipAddress: true,
        macAddress: true,
        usesStaticIp: true,
        isFixedAsset: true,
        movementAlertsEnabled: true,
        expectedLocationZoneId: true,
        notes: true,
        assignedTo: true,
        employee: { select: { fullName: true, employeeId: true } },
        photos: { select: { id: true, photoType: true, isPrimary: true, sizeBytes: true, fileSize: true, thumbnailPath: true, mimeType: true } },
        rmaItems: { select: { result: true, returnedAt: true } },
        assignmentItems: { select: { returnedAt: true } },
        assetLoanItems: { select: { returnedAt: true } },
        facturaLineItemLinks: {
          select: {
            id: true,
            lineItem: { select: { id: true, description: true, quantity: true, factura: { select: { id: true, facturaNumber: true, vendorName: true } } } },
          },
        },
        aliases: { select: { aliasType: true, value: true } },
        sourceRelationships: { select: { relationshipType: true, status: true, targetDeviceId: true } },
        targetRelationships: { select: { relationshipType: true, status: true, sourceDeviceId: true } },
        maintenanceDueAt: true,
        purchaseDate: true,
        warrantyExpiresAt: true,
        facturaId: true,
        valueProfile: {
          select: {
            purchaseValue: true,
            currency: true,
            purchaseDate: true,
            usefulLifeMonths: true,
            residualPercent: true,
            residualValue: true,
            currentEstimatedValue: true,
            lastCalculatedAt: true,
            sourceType: true,
            sourceFacturaLineItemAssetId: true,
          },
        },
        bitLockerRecoveryKey: {
          select: {
            id: true,
            keyId: true,
            volumeLabel: true,
            protectorId: true,
            source: true,
            createdAt: true,
            updatedAt: true,
            lastViewedAt: true,
            lastViewedByName: true,
          },
        },
        lastCleanedAt: true,
        cleaningIntervalDays: true,
        maintenanceRecords: { select: { id: true, maintenanceType: true, result: true, performedAt: true, nextDueAt: true, notes: true }, orderBy: { performedAt: "desc" }, take: 10 },
      },
    }),
    prisma.factura.findMany({
      orderBy: [{ receivedDate: "desc" }, { createdAt: "desc" }],
      include: {
        assets: { select: { id: true, name: true, serialNumber: true } },
        stockItems: { select: { id: true, name: true } },
        lineItems: { include: { assetLinks: true } },
        extractionAttempts: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    }),
    prisma.stockItem.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        photos: { select: { id: true } },
        stockIssues: { select: { status: true } },
        _count: { select: { movements: true, maintenanceRecords: true, stockIssues: true, purchaseNoteItems: true } },
      },
    }),
    prisma.warehouseMap.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.accessPointMapLocation.findMany({ orderBy: [{ active: "desc" }, { displayPath: "asc" }, { locationLabel: "asc" }] }),
  ]);

  const duplicateIps = findDuplicateIps(devices);
  const duplicateMacs = findDuplicateMacs(devices);
  const missing = summarizeMissingFields(devices);
  const mobile = summarizeMobileAssets(devices);
  const staticNetwork = summarizeStaticAssets(devices);
  const stock = summarizeStockReview(stockItems);
  const stockPhotoCompliance = {
    stockItemsWithNoPhotos: stockItems.filter((item) => item.active !== false && (item.photos?.length ?? 0) === 0),
  };
  const suspiciousStock = detectSuspiciousStockComments(stockItems);
  const stockVsAssetClassification = summarizeStockVsAssetClassification(devices, stockItems);
  const suspiciousAssetNames = detectSuspiciousAssetNames(devices);
  const labelAliasReview = findPhysicalLabelAliasConflicts(devices);
  const sledCategoryReview = findSledDisplayReview(devices);
  const mobileLegacy = buildMobilePairingCleanupPlan(devices);
  const photoCompliance = summarizePhotoCompliance(devices);
  const maintenance = summarizeMaintenanceReview(devices);
  const assetValue = summarizeAssetValueQuality(devices);
  const bitLocker = summarizeBitLockerQuality(devices);
  const facturaLineItems = summarizeFacturaLineItemQuality(facturas, devices);
  const importAudit = summarizeImportRun(latestRun, latestBackupRoot());
  const mapHealth = summarizeMapHealth(maps, mapAnchors);
  const invalidIps = devices.filter((device) => device.ipAddress && !validateIPv4(device.ipAddress).ok);
  const duplicateAssetTags = exactDuplicateGroups(devices, "assetTag");
  const duplicateSerials = exactDuplicateGroups(devices, "serialNumber");
  const unlinkedFacturas = findUnlinkedFacturas(facturas);
  const [activeRmaCount, devicesInRmaCount, offlineSyncHealth] = await Promise.all([
    prisma.rmaCase.count({ where: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } }),
    prisma.rmaItem.count({ where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } } }),
    getOfflineConflictHealth(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    urgent: {
      duplicateIps,
      duplicateMacs,
      mobileViolations: mobile.violations,
      invalidIps,
      duplicateAssetTags,
      duplicateSerials,
      suspiciousStock,
      suspiciousAssetNames,
      suspiciousAssignments: mobileLegacy.suspiciousAssignments,
      labelAliasConflicts: labelAliasReview,
    },
    duplicateIps,
    duplicateMacs,
    skippedDuplicates: importAudit?.skippedDuplicates ?? [],
    unlinkedFacturas,
    missing,
    staticNetwork,
    mobile,
    stock,
    stockPhotoCompliance,
    suspiciousStock,
    stockVsAssetClassification,
    suspiciousAssetNames,
    labelAliasReview,
    sledCategoryReview,
    suspiciousAssignments: mobileLegacy.suspiciousAssignments,
    mobilePairingReview: {
      aliasesToCreate: mobileLegacy.aliasesToCreate,
      pairingsToCreate: mobileLegacy.pairingsToCreate,
      assignmentsToClear: mobileLegacy.assignmentsToClear,
      ambiguousPairings: mobileLegacy.ambiguousPairings,
      missingExpectedPairings: devices.filter((device) => {
        const text = `${device.name} ${device.assetTag ?? ""} ${device.model ?? ""} ${device.notes ?? ""}`.toLowerCase();
        const expectsPairing = device.category === "PHONE" || text.includes("source: ipod") || text.includes("source: iphone") || text.includes("ipod") || text.includes("iphone");
        const hasPairing = [...(device.sourceRelationships ?? []), ...(device.targetRelationships ?? [])].some((relationship) => ["PAIRED_WITH", "IPOD_SLED_PAIR", "IPHONE_SLED_PAIR"].includes(relationship.relationshipType) && ["ACTIVE", "NEEDS_REVIEW"].includes(relationship.status));
        return expectsPairing && !hasPairing;
      }),
    },
    photoCompliance,
    maintenance,
    assetValue,
    bitLocker,
    facturaLineItems,
    mapHealth,
    offlineSyncHealth,
    importAudit,
    totals: {
      assets: devices.length,
      facturas: facturas.length,
      stockItems: stockItems.length,
      activeRmas: activeRmaCount,
      devicesInRma: devicesInRmaCount,
    },
  };
}

export async function getDataQualityExportRows(type: string) {
  const review = await getDataQualityReview();
  if (type === "duplicate-ips") {
    return review.duplicateIps.flatMap((group) =>
      group.assets.map((asset) => ({
        ipAddress: group.ipAddress,
        count: group.count,
        assetName: asset.name,
        assetTag: asset.assetTag,
        category: asset.category,
        status: asset.status,
        location: asset.location ?? asset.areaDepartment ?? "",
        assetUrl: `/devices/${asset.id}`,
      })),
    );
  }
  if (type === "duplicate-macs") {
    return review.duplicateMacs.flatMap((group) =>
      group.assets.map((asset) => ({
        macAddress: group.macAddress,
        count: group.count,
        assetName: asset.name,
        assetTag: asset.assetTag,
        category: asset.category,
        status: asset.status,
        location: asset.location ?? asset.areaDepartment ?? "",
        assetUrl: `/devices/${asset.id}`,
      })),
    );
  }
  if (type === "unlinked-facturas") {
    return review.unlinkedFacturas.map((factura) => ({
      facturaNumber: factura.facturaNumber,
      vendorName: factura.vendorName,
      purchaseDate: dateText(factura.purchaseDate),
      receivedDate: dateText(factura.receivedDate),
      notes: factura.notes,
      facturaUrl: `/facturas/${factura.id}`,
    }));
  }
  if (type === "skipped-duplicates") {
    return review.skippedDuplicates.map((row) => ({
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      duplicateType: row.duplicateType,
      duplicateKey: row.duplicateKey,
      firstSeenAt: row.firstSeenAt,
      message: row.message,
      rawJson: JSON.stringify(row.raw),
    }));
  }
  if (type === "missing-asset-tags") return assetRows(review.missing.missingAssetTag);
  if (type === "missing-serials") return assetRows(review.missing.missingSerial);
  if (type === "static-missing-ip-mac") return assetRows([...review.staticNetwork.missingIp, ...review.staticNetwork.missingMac]);
  if (type === "mobile-network-violations") return assetRows(review.mobile.violations);
  if (type === "stock-review") {
    return review.stock.notLinkedToFacturas.map((item) => ({
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantityOnHand: item.quantityOnHand,
      minimumQuantity: item.minimumQuantity,
      storageLocation: item.storageLocation,
      linkedToFactura: Boolean(item.facturaId),
      stockUrl: `/stock/${item.id}`,
    }));
  }
  if (type === "stock-cleanup-review") {
    return [
      ...review.suspiciousStock.map((item) => ({
        reviewType: "suspicious-comment-row",
        id: item.id,
        name: item.name,
        currentCategory: item.category,
        suggestedCategory: "",
        quantityOnHand: item.quantityOnHand,
        sku: item.sku,
        vendorName: item.vendorName ?? "",
        storageLocation: item.storageLocation,
        reason: item.reason,
        canArchive: item.canArchive,
        stockUrl: `/stock/${item.id}`,
      })),
      ...review.stock.categorySuggestions.map((item) => ({
        reviewType: "category-suggestion",
        id: item.id,
        name: item.name,
        currentCategory: item.category,
        suggestedCategory: item.suggestedCategory,
        quantityOnHand: item.quantityOnHand,
        sku: item.sku,
        vendorName: item.vendorName ?? "",
        storageLocation: item.storageLocation,
        reason: item.suggestionReason,
        canArchive: "",
        stockUrl: `/stock/${item.id}`,
      })),
    ];
  }
  if (type === "suspicious-stock-comments") {
    return review.suspiciousStock.map((item) => ({
      id: item.id,
      name: item.name,
      quantityOnHand: item.quantityOnHand,
      category: item.category,
      sku: item.sku,
      vendorName: item.vendorName ?? "",
      storageLocation: item.storageLocation,
      sourceSheet: item.source?.sheetName ?? "",
      sourceRow: item.source?.rowNumber ?? "",
      reason: item.reason,
      canArchive: item.canArchive,
      stockUrl: `/stock/${item.id}`,
    }));
  }
  if (type === "suspicious-asset-names") {
    return review.suspiciousAssetNames.map((asset) => ({
      id: asset.id,
      currentName: asset.name,
      assetTag: asset.assetTag,
      category: asset.category,
      brand: asset.brand,
      model: asset.model,
      status: asset.status,
      assignedEmployee: asset.employee?.fullName ?? "",
      sourceSheet: asset.source?.sheetName ?? "",
      sourceRow: asset.source?.rowNumber ?? "",
      reason: asset.reason,
      suggestedName: asset.suggestedName,
      assetUrl: `/devices/${asset.id}`,
    }));
  }
  if (type === "label-alias-review") {
    return review.labelAliasReview.flatMap((group) =>
      group.aliases.map((item) => ({
        physicalLabelCode: item.value,
        normalizedCode: group.normalizedValue,
        count: group.count,
        aliasType: item.aliasType,
        assetId: item.device.id,
        assetName: item.device.name,
        assetTag: item.device.assetTag,
        serialNumber: item.device.serialNumber,
        category: item.device.category,
        assetUrl: `/devices/${item.device.id}`,
      })),
    );
  }
  if (type === "sled-category-review") {
    return review.sledCategoryReview.map((asset) => ({
      assetId: asset.id,
      currentName: asset.name,
      suggestedDisplayName: asset.suggestedDisplayName,
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber,
      currentCategory: asset.category,
      suggestedCategoryLabel: asset.suggestedCategoryLabel,
      status: asset.status,
      condition: asset.condition ?? "",
      reason: asset.reason,
      sourceSheet: asset.source?.sheetName ?? "",
      sourceRow: asset.source?.rowNumber ?? "",
      assetUrl: `/devices/${asset.id}`,
    }));
  }
  if (type === "suspicious-assignments") {
    return review.suspiciousAssignments.map((item) => ({
      assetId: item.device.id,
      assetTag: item.device.assetTag,
      assetName: item.device.name,
      category: item.device.category,
      assignedValue: item.assignedValue,
      reason: item.reason,
      suggestedAction: item.suggestedAction,
      possibleLinkedAsset: item.possibleLinkedAsset?.assetTag ?? item.possibleLinkedAsset?.name ?? "",
      assetUrl: `/devices/${item.device.id}`,
    }));
  }
  if (type === "mobile-pairing-review") {
    return [
      ...review.mobilePairingReview.pairingsToCreate.map((item) => ({
        status: "MATCHED",
        sourceDeviceId: item.sourceDeviceId,
        targetDeviceId: item.targetDeviceId,
        relationshipType: item.relationshipType,
        sourceReference: item.sourceReference,
        confidence: item.confidence,
        reason: "Safe exact pairing candidate.",
      })),
      ...review.mobilePairingReview.ambiguousPairings.map((item) => ({
        status: item.status,
        sourceDeviceId: item.mobileDevice?.id ?? "",
        targetDeviceId: item.sledDevice?.id ?? "",
        relationshipType: "",
        sourceReference: item.reference,
        confidence: item.confidence,
        reason: item.reason,
      })),
    ];
  }
  if (type === "device-aliases") {
    return review.mobilePairingReview.aliasesToCreate.map((alias) => ({
      deviceId: alias.deviceId,
      aliasType: alias.aliasType,
      value: alias.value,
      sourceSheet: alias.sourceSheet ?? "",
      sourceColumn: alias.sourceColumn ?? "",
      sourceRow: alias.sourceRow ?? "",
      notes: alias.notes ?? "",
    }));
  }
  if (type === "missing-required-photos") {
    return review.photoCompliance.missingRequired.map((asset) => ({
      id: asset.id,
      name: asset.name,
      assetTag: asset.assetTag,
      category: asset.category,
      status: asset.status,
      assignedEmployee: asset.employee?.fullName ?? "",
      missingPhotoTypes: asset.checklist.missing.map((type) => requiredPhotoLabels[type]).join("; "),
      assetUrl: `/devices/${asset.id}`,
      addPhotoUrl: `/devices/${asset.id}#photos`,
    }));
  }
  if (type === "asset-value-review") {
    return review.assetValue.reviewRows.map((asset) => ({
      assetId: asset.id,
      assetTag: asset.assetTag,
      assetName: asset.name,
      category: asset.category,
      status: asset.status,
      purchaseValue: asset.valueProfile?.purchaseValue ?? "",
      currency: asset.currency,
      purchaseDate: dateText(asset.valueProfile?.purchaseDate ?? asset.purchaseDate),
      currentEstimatedValue: asset.currentEstimatedValue ?? "",
      lastCalculatedAt: dateText(asset.valueProfile?.lastCalculatedAt),
      reason: asset.reason,
      assetUrl: `/devices/${asset.id}`,
      valueUrl: `/devices/${asset.id}/value`,
    }));
  }
  if (type === "bitlocker-vault-review") {
    return [
      ...review.bitLocker.missingKey.map((asset) => ({
        reviewType: "missing-bitlocker-key",
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        category: asset.category,
        status: asset.status,
        keyId: "",
        volumeLabel: "",
        protectorId: "",
        reason: "Eligible laptop/desktop is missing a protected BitLocker recovery key.",
        assetUrl: `/devices/${asset.id}`,
        vaultUrl: `/devices/${asset.id}/bitlocker/edit`,
      })),
      ...review.bitLocker.retiredWithKey.map((asset) => ({
        reviewType: "retired-with-bitlocker-key",
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        category: asset.category,
        status: asset.status,
        keyId: asset.bitLockerRecoveryKey?.keyId ?? "",
        volumeLabel: asset.bitLockerRecoveryKey?.volumeLabel ?? "",
        protectorId: asset.bitLockerRecoveryKey?.protectorId ?? "",
        reason: "Retired/disposed asset still has a protected BitLocker vault record.",
        assetUrl: `/devices/${asset.id}`,
        vaultUrl: `/devices/${asset.id}/bitlocker`,
      })),
      ...review.bitLocker.missingMetadata.map((asset) => ({
        reviewType: "bitlocker-missing-metadata",
        assetId: asset.id,
        assetTag: asset.assetTag,
        assetName: asset.name,
        category: asset.category,
        status: asset.status,
        keyId: asset.bitLockerRecoveryKey?.keyId ?? "",
        volumeLabel: asset.bitLockerRecoveryKey?.volumeLabel ?? "",
        protectorId: asset.bitLockerRecoveryKey?.protectorId ?? "",
        reason: "Protected key exists but key ID, volume label, or protector ID metadata is missing.",
        assetUrl: `/devices/${asset.id}`,
        vaultUrl: `/devices/${asset.id}/bitlocker/edit`,
      })),
    ];
  }
  if (type === "factura-line-item-review") {
    return [
      ...review.facturaLineItems.facturasWithNoLineItems.map((factura) => ({
        reviewType: "factura-with-no-line-items",
        facturaNumber: factura.facturaNumber,
        vendorName: factura.vendorName,
        xmlPresent: Boolean(factura.xmlPath || factura.xmlOriginalName),
        xmlUuid: factura.xmlUuid ?? "",
        xmlFolio: [factura.xmlSerie, factura.xmlFolio].filter(Boolean).join("-"),
        lineItemDescription: "",
        assetTag: "",
        reason: "Factura has no structured line items.",
        url: `/facturas/${factura.id}`,
      })),
      ...review.facturaLineItems.facturasWithAttachmentNoLineItems.map((factura) => ({
        reviewType: "attachment-with-no-line-items",
        facturaNumber: factura.facturaNumber,
        vendorName: factura.vendorName,
        xmlPresent: Boolean(factura.xmlPath || factura.xmlOriginalName),
        xmlUuid: factura.xmlUuid ?? "",
        xmlFolio: [factura.xmlSerie, factura.xmlFolio].filter(Boolean).join("-"),
        lineItemDescription: "",
        assetTag: "",
        reason: "Factura has an attachment but no structured line items. Try assisted extraction or enter line items manually.",
        url: `/facturas/${factura.id}/extract`,
      })),
      ...review.facturaLineItems.facturasWithXmlNoLineItems.map((factura) => ({
        reviewType: "xml-with-no-line-items",
        facturaNumber: factura.facturaNumber,
        vendorName: factura.vendorName,
        xmlPresent: true,
        xmlUuid: factura.xmlUuid ?? "",
        xmlFolio: [factura.xmlSerie, factura.xmlFolio].filter(Boolean).join("-"),
        lineItemDescription: "",
        assetTag: "",
        reason: "Factura has XML but no structured line items. Use XML extraction or enter line items manually.",
        url: `/facturas/${factura.id}/extract`,
      })),
      ...review.facturaLineItems.extractionAttemptedNoLineItems.map((factura) => ({
        reviewType: "extraction-attempted-no-line-items",
        facturaNumber: factura.facturaNumber,
        vendorName: factura.vendorName,
        xmlPresent: Boolean(factura.xmlPath || factura.xmlOriginalName),
        xmlUuid: factura.xmlUuid ?? "",
        xmlFolio: [factura.xmlSerie, factura.xmlFolio].filter(Boolean).join("-"),
        lineItemDescription: "",
        assetTag: "",
        reason: "Extraction was attempted but no line items have been created.",
        url: `/facturas/${factura.id}/extract`,
      })),
      ...review.facturaLineItems.xmlExtractionAttemptedNoLineItems.map((factura) => ({
        reviewType: "xml-extraction-attempted-no-line-items",
        facturaNumber: factura.facturaNumber,
        vendorName: factura.vendorName,
        xmlPresent: true,
        xmlUuid: factura.xmlUuid ?? "",
        xmlFolio: [factura.xmlSerie, factura.xmlFolio].filter(Boolean).join("-"),
        lineItemDescription: "",
        assetTag: "",
        reason: "XML extraction was attempted but no line items have been created.",
        url: `/facturas/${factura.id}/extract`,
      })),
      ...review.facturaLineItems.noTextExtractionAttempts.map((factura) => ({
        reviewType: "no-text-or-failed-extraction",
        facturaNumber: factura.facturaNumber,
        vendorName: factura.vendorName,
        xmlPresent: Boolean(factura.xmlPath || factura.xmlOriginalName),
        xmlUuid: factura.xmlUuid ?? "",
        xmlFolio: [factura.xmlSerie, factura.xmlFolio].filter(Boolean).join("-"),
        lineItemDescription: "",
        assetTag: "",
        reason: "Latest extraction history includes no selectable text or extraction failure. Manual entry may be required.",
        url: `/facturas/${factura.id}/extract`,
      })),
      ...review.facturaLineItems.xmlTotalMismatches.map((factura) => ({
        reviewType: "xml-total-mismatch",
        facturaNumber: factura.facturaNumber,
        vendorName: factura.vendorName,
        xmlPresent: true,
        xmlUuid: factura.xmlUuid ?? "",
        xmlFolio: [factura.xmlSerie, factura.xmlFolio].filter(Boolean).join("-"),
        xmlTotal: factura.xmlTotal,
        lineItemTotal: factura.lineItemTotal,
        lineItemDescription: "",
        assetTag: "",
        reason: "XML total does not match the sum of structured line items.",
        url: `/facturas/${factura.id}`,
      })),
      ...review.facturaLineItems.lineItemsWithUnlinkedQuantity.map((lineItem) => ({
        reviewType: "line-item-unlinked-quantity",
        facturaNumber: lineItem.factura.facturaNumber,
        vendorName: lineItem.factura.vendorName,
        xmlPresent: Boolean(lineItem.factura.xmlPath || lineItem.factura.xmlOriginalName),
        xmlUuid: lineItem.factura.xmlUuid ?? "",
        xmlFolio: [lineItem.factura.xmlSerie, lineItem.factura.xmlFolio].filter(Boolean).join("-"),
        lineItemDescription: lineItem.description,
        quantity: lineItem.quantity,
        linkedCount: lineItem.linkedCount,
        unlinkedQuantity: lineItem.unlinkedQuantity,
        reason: "Line item quantity is not fully linked to assets.",
        url: `/facturas/${lineItem.factura.id}/line-items/${lineItem.id}/link-assets`,
      })),
      ...review.facturaLineItems.linkedAssetsMissingValue.map((asset) => ({
        reviewType: "linked-asset-missing-value",
        facturaNumber: asset.facturaLineItemLinks?.[0]?.lineItem.factura.facturaNumber ?? "",
        vendorName: asset.facturaLineItemLinks?.[0]?.lineItem.factura.vendorName ?? "",
        lineItemDescription: asset.facturaLineItemLinks?.[0]?.lineItem.description ?? "",
        assetTag: asset.assetTag,
        assetName: asset.name,
        reason: "Asset is linked to a line item but has no AssetValueProfile.",
        url: `/devices/${asset.id}/value`,
      })),
    ];
  }
  return null;
}

function exactDuplicateGroups(devices: ReviewDevice[], field: "assetTag" | "serialNumber") {
  const groups = new Map<string, ReviewDevice[]>();
  for (const device of devices) {
    const value = device[field]?.trim().toUpperCase();
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), device]);
  }
  return [...groups.entries()].filter(([, assets]) => assets.length > 1).map(([value, assets]) => ({ value, count: assets.length, assets }));
}

function assetRows(devices: ReviewDevice[]) {
  const seen = new Set<string>();
  return devices.filter((device) => {
    if (seen.has(device.id)) return false;
    seen.add(device.id);
    return true;
  }).map((device) => ({
    name: device.name,
    assetTag: device.assetTag,
    serialNumber: device.serialNumber,
    model: device.model,
    category: device.category,
    status: device.status,
    location: device.location ?? device.areaDepartment ?? "",
    ipAddress: device.ipAddress,
    macAddress: device.macAddress,
    assetUrl: `/devices/${device.id}`,
  }));
}

function legacyRawValue(raw: Record<string, unknown>, field: string) {
  for (const [header, value] of Object.entries(raw)) {
    if (matchLegacyColumn(header) === field) return String(value ?? "");
  }
  return "";
}

function parseRawJson(value?: string | null) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function latestBackupRoot() {
  return process.env.DATA_QUALITY_BACKUP_ROOT ?? "backups\\pre-import-20260529-080303";
}

function findAuditFiles(backupRoot?: string | null) {
  if (!backupRoot) return [];
  return [
    "legacy-preview-warning-report.csv",
    "legacy-preview-duplicate-report.csv",
    "legacy-import-result.json",
    "legacy-post-import-audit.json",
  ].map((fileName) => ({ fileName, path: `${backupRoot}\\${fileName}` }));
}

function dateText(value?: Date | string | null) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function normalizeDateValue(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function includesText(device: ReviewDevice, value: string) {
  return `${device.name} ${device.model ?? ""} ${device.assetTag ?? ""}`.toLowerCase().includes(value);
}

function isMobileAppleReviewAsset(device: ReviewDevice) {
  if (device.category === "TABLET") return true;
  if (device.category !== "PHONE") return false;
  const text = `${device.name} ${device.model ?? ""} ${device.assetTag ?? ""}`.toLowerCase();
  return ["iphone", "ipod", "ipad", "apple"].some((value) => text.includes(value));
}

type SourceReference = { sheetName: string; rowNumber: number };

function suspiciousStockReason(item: ReviewStockItem) {
  const name = normalizeText(item.name);
  if (!name) return "";
  const startMatch = suspiciousStockStarts.find((pattern) => name.startsWith(pattern));
  const containsMatch = suspiciousStockContains.find((pattern) => name.includes(pattern));
  if (!startMatch && !containsMatch) return "";

  const evidence: string[] = [`Name looks like a legacy comment${startMatch ? ` (${startMatch})` : ""}.`];
  if (item.quantityOnHand === 0) evidence.push("Quantity is 0.");
  if (!item.sku) evidence.push("No SKU.");
  if (!item.vendorName) evidence.push("No vendor.");
  if (!item.storageLocation) evidence.push("No storage location.");
  if (!item.facturaId) evidence.push("No factura link.");
  if ((item._count?.movements ?? 0) === 0) evidence.push("No stock movements.");
  return evidence.join(" ");
}

function suspiciousAssetNameReason(asset: ReviewDevice) {
  const name = normalizeText(asset.name);
  const model = normalizeText(asset.model);
  const assetTag = normalizeText(asset.assetTag);
  const category = String(asset.category);
  const accessPointName = name.startsWith("access point") || name === "access point" || name.includes(" access point ");
  if (!accessPointName) return "";
  if ((category === "LAPTOP" || model.includes("latitude") || assetTag.startsWith("ght-lp")) && accessPointName) return "Laptop/Latitude record is named Access Point.";
  if (["LAPTOP", "DESKTOP", "PHONE", "TABLET", "OTHER"].includes(category)) return `${category.replaceAll("_", " ")} record has Access Point in the display name.`;
  return "";
}

function sourceFromNotes(notes?: string | null): SourceReference | null {
  if (!notes) return null;
  const match = notes.match(/Source:\s*(.*?)\s+row\s+(\d+)/i);
  if (!match) return null;
  return { sheetName: match[1].trim(), rowNumber: Number(match[2]) };
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanJoinToken(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
