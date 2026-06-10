import type {
  Device,
  DeviceAlias,
  DeviceCategory,
  DeviceStatus,
  InventoryAuditExpectedItem,
  InventoryAuditScan,
  InventoryAuditScanResult,
  InventoryAuditScopeType,
  InventoryAuditSession,
  InventoryAuditSessionStatus,
  Prisma,
} from "@prisma/client";
import { ClientInputError } from "@/lib/api";
import { getAssetDisplayName } from "@/lib/asset-display";
import { normalizedAliasCompare } from "@/lib/label-aliases";
import { prisma } from "@/lib/prisma";
import { parseScannedLabel } from "@/lib/scan-label";

export const auditIncludeStatuses: DeviceStatus[] = ["ACTIVE", "AVAILABLE", "RESERVED", "IN_USE_ASSIGNED"];
export const auditExcludedStatuses: DeviceStatus[] = ["RETIRED", "LOST", "DISPOSED", "IN_REPAIR_RMA", "MISSING"];

export type AuditCreateInput = {
  title: string;
  scopeType: InventoryAuditScopeType;
  area?: string | null;
  department?: string | null;
  location?: string | null;
  category?: DeviceCategory | null;
  includeLoaned?: boolean;
  includeRepair?: boolean;
  includeMissingLost?: boolean;
  createdBy?: string | null;
  notes?: string | null;
};

export type AuditScopeAsset = Pick<Device, "id" | "assetTag" | "name" | "category" | "location" | "areaDepartment" | "status" | "brand" | "model" | "serialNumber">;

export type AuditScanDevice = Pick<Device, "id" | "assetTag" | "name" | "category" | "location" | "areaDepartment" | "status" | "brand" | "model" | "serialNumber"> & {
  aliases?: Array<Pick<DeviceAlias, "aliasType" | "value">>;
};

export type AuditSessionWithItems = InventoryAuditSession & {
  expectedItems: InventoryAuditExpectedItem[];
  scans: InventoryAuditScan[];
};

export const auditExportTypes = [
  "audit-summary",
  "audit-expected-items",
  "audit-found",
  "audit-missing",
  "audit-wrong-area",
  "audit-unknown-labels",
  "audit-duplicates",
  "audit-needs-review",
  "audit-all-findings",
] as const;

export type AuditExportType = (typeof auditExportTypes)[number];

type AuditExportDevice = Pick<Device, "id" | "name" | "assetTag" | "serialNumber" | "category" | "location" | "areaDepartment" | "status">;
type AuditExportExpectedItem = Pick<InventoryAuditExpectedItem, "id" | "deviceId" | "expectedAssetTag" | "expectedDisplayName" | "expectedCategory" | "expectedLocation" | "expectedStatus" | "resultStatus"> & {
  device?: AuditExportDevice | null;
};
type AuditExportScan = Pick<InventoryAuditScan, "id" | "scannedValue" | "resultType" | "scannedAt" | "notes" | "matchedDeviceId"> & {
  matchedDevice?: AuditExportDevice | null;
};
export type AuditExportSession = Pick<InventoryAuditSession, "id" | "auditNumber" | "title" | "area" | "department" | "location" | "category" | "scopeType" | "status" | "startedAt" | "completedAt"> & {
  expectedItems: AuditExportExpectedItem[];
  scans: AuditExportScan[];
};
export type AuditFindingTaskType = "missing" | "wrong-area" | "unknown-label" | "duplicate" | "needs-review";

export function normalizeAuditInput(input: Record<string, unknown>): AuditCreateInput {
  const title = clean(input.title) || "Physical inventory audit";
  const scopeType = normalizeScopeType(input.scopeType);
  const category = clean(input.category);
  return {
    title,
    scopeType,
    area: clean(input.area),
    department: clean(input.department),
    location: clean(input.location),
    category: category ? (category as DeviceCategory) : null,
    includeLoaned: Boolean(input.includeLoaned),
    includeRepair: Boolean(input.includeRepair),
    includeMissingLost: Boolean(input.includeMissingLost),
    createdBy: clean(input.createdBy),
    notes: clean(input.notes),
  };
}

export function buildAuditDeviceWhere(input: AuditCreateInput): Prisma.DeviceWhereInput {
  const statuses = [...auditIncludeStatuses];
  if (input.includeLoaned) statuses.push("LOANED_OUT");
  if (input.includeRepair) statuses.push("IN_REPAIR_RMA");
  if (input.includeMissingLost) statuses.push("MISSING", "LOST");

  const locationTerms = [input.area, input.department, input.location].filter((value): value is string => Boolean(value?.trim()));
  return {
    status: { in: [...new Set(statuses)] },
    ...(input.category ? { category: input.category } : {}),
    ...(locationTerms.length
      ? {
          OR: locationTerms.flatMap((term) => [
            { location: { contains: term } },
            { areaDepartment: { contains: term } },
          ]),
        }
      : {}),
  };
}

export function assetMatchesAuditScope(asset: AuditScopeAsset, session: Pick<InventoryAuditSession, "area" | "department" | "location" | "category">) {
  const categoryMatches = !session.category || asset.category === session.category;
  const scopeTerms = [session.area, session.department, session.location].map(normalize).filter(Boolean);
  if (!scopeTerms.length) return categoryMatches;
  const assetLocationText = normalize(`${asset.location ?? ""} ${asset.areaDepartment ?? ""}`);
  return categoryMatches && scopeTerms.some((term) => assetLocationText.includes(term));
}

export function auditNumber(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `AUD-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function estimateAuditExpectedCount(input: AuditCreateInput) {
  return prisma.device.count({ where: buildAuditDeviceWhere(input) });
}

export async function createAuditSession(input: AuditCreateInput) {
  const assets = await prisma.device.findMany({
    where: buildAuditDeviceWhere(input),
    orderBy: [{ location: "asc" }, { name: "asc" }],
    select: {
      id: true,
      assetTag: true,
      name: true,
      category: true,
      location: true,
      areaDepartment: true,
      status: true,
      brand: true,
      model: true,
      serialNumber: true,
    },
  });

  return prisma.$transaction(async (tx) => {
    const session = await tx.inventoryAuditSession.create({
      data: {
        auditNumber: auditNumber(),
        title: input.title,
        scopeType: input.scopeType,
        area: input.area,
        department: input.department,
        location: input.location,
        category: input.category,
        status: "ACTIVE",
        createdBy: input.createdBy,
        notes: input.notes,
        expectedItems: {
          create: assets.map((asset) => ({
            deviceId: asset.id,
            expectedAssetTag: asset.assetTag,
            expectedDisplayName: getAssetDisplayName(asset),
            expectedCategory: asset.category,
            expectedLocation: asset.location || asset.areaDepartment,
            expectedStatus: asset.status,
            resultStatus: "PENDING",
          })),
        },
      },
      include: { expectedItems: true, scans: true },
    });

    await tx.activityLog.create({
      data: {
        action: "audit.started",
        entity: "inventory-audit",
        entityId: session.id,
        message: `${session.auditNumber ?? "Audit"} started with ${assets.length} expected asset${assets.length === 1 ? "" : "s"}.`,
        metadata: JSON.stringify({ scope: input, expectedCount: assets.length }),
      },
    });

    return session;
  });
}

export function auditProgress(expectedItems: Array<Pick<InventoryAuditExpectedItem, "resultStatus">>, scans: Array<Pick<InventoryAuditScan, "resultType">>) {
  const found = expectedItems.filter((item) => item.resultStatus === "FOUND").length;
  const missing = expectedItems.filter((item) => item.resultStatus === "MISSING").length;
  const pending = expectedItems.filter((item) => item.resultStatus === "PENDING").length;
  return {
    expected: expectedItems.length,
    found,
    remaining: pending,
    missing,
    wrongArea: scans.filter((scan) => scan.resultType === "FOUND_WRONG_AREA" || scan.resultType === "FOUND_NOT_EXPECTED").length,
    unknown: scans.filter((scan) => scan.resultType === "UNKNOWN_LABEL").length,
    duplicates: scans.filter((scan) => scan.resultType === "DUPLICATE_SCAN").length,
    needsReview: scans.filter((scan) => scan.resultType === "NEEDS_REVIEW").length + expectedItems.filter((item) => item.resultStatus === "NEEDS_REVIEW").length,
  };
}

export function isAuditExportType(value: string): value is AuditExportType {
  return (auditExportTypes as readonly string[]).includes(value);
}

export function buildAuditExportRows(session: AuditExportSession, type: AuditExportType) {
  const progress = auditProgress(session.expectedItems, session.scans);
  if (type === "audit-summary") {
    return [
      {
        auditNumber: session.auditNumber,
        title: session.title,
        status: session.status,
        scope: auditScopeLabel(session),
        expectedCount: progress.expected,
        foundCount: progress.found,
        missingCount: progress.missing || progress.remaining,
        wrongAreaCount: progress.wrongArea,
        unknownLabelCount: progress.unknown,
        duplicateCount: progress.duplicates,
        needsReviewCount: progress.needsReview,
        startedAt: formatDateTime(session.startedAt),
        completedAt: formatDateTime(session.completedAt),
      },
    ];
  }

  const found = session.expectedItems.filter((item) => item.resultStatus === "FOUND");
  const missing = session.expectedItems.filter((item) => item.resultStatus === "PENDING" || item.resultStatus === "MISSING");
  const wrongArea = session.scans.filter((scan) => scan.resultType === "FOUND_WRONG_AREA" || scan.resultType === "FOUND_NOT_EXPECTED");
  const unknown = session.scans.filter((scan) => scan.resultType === "UNKNOWN_LABEL");
  const duplicates = session.scans.filter((scan) => scan.resultType === "DUPLICATE_SCAN");
  const needsReviewScans = session.scans.filter((scan) => scan.resultType === "NEEDS_REVIEW");
  const needsReviewItems = session.expectedItems.filter((item) => item.resultStatus === "NEEDS_REVIEW");

  if (type === "audit-expected-items") return session.expectedItems.map((item) => expectedItemExportRow(session, item, "EXPECTED_ITEM"));
  if (type === "audit-found") return found.map((item) => expectedItemExportRow(session, item, "FOUND"));
  if (type === "audit-missing") return missing.map((item) => expectedItemExportRow(session, item, "MISSING"));
  if (type === "audit-wrong-area") return wrongArea.map((scan) => scanExportRow(session, scan));
  if (type === "audit-unknown-labels") return unknown.map((scan) => scanExportRow(session, scan));
  if (type === "audit-duplicates") return duplicates.map((scan) => scanExportRow(session, scan, originalScanTime(session.scans, scan)));
  if (type === "audit-needs-review") return [...needsReviewScans.map((scan) => scanExportRow(session, scan)), ...needsReviewItems.map((item) => expectedItemExportRow(session, item, "NEEDS_REVIEW"))];
  return [
    ...missing.map((item) => expectedItemExportRow(session, item, "MISSING")),
    ...wrongArea.map((scan) => scanExportRow(session, scan)),
    ...unknown.map((scan) => scanExportRow(session, scan)),
    ...duplicates.map((scan) => scanExportRow(session, scan, originalScanTime(session.scans, scan))),
    ...needsReviewScans.map((scan) => scanExportRow(session, scan)),
    ...needsReviewItems.map((item) => expectedItemExportRow(session, item, "NEEDS_REVIEW")),
  ];
}

export function auditFindingTaskDetails(input: {
  audit: Pick<InventoryAuditSession, "id" | "auditNumber" | "title">;
  type: AuditFindingTaskType;
  scannedValue?: string | null;
  assetTag?: string | null;
  assetName?: string | null;
  expectedLocation?: string | null;
  currentLocation?: string | null;
  timestamp?: Date | string | null;
}) {
  const target = input.assetTag || input.assetName || input.scannedValue || "audit finding";
  const titlePrefix: Record<AuditFindingTaskType, string> = {
    missing: "Audit missing asset",
    "wrong-area": "Audit wrong-area asset",
    "unknown-label": "Audit unknown label",
    duplicate: "Audit duplicate scan",
    "needs-review": "Audit review item",
  };
  const notes = [
    `Audit: ${input.audit.auditNumber || input.audit.title}`,
    `Finding type: ${input.type.replaceAll("-", " ")}`,
    input.scannedValue ? `Scanned value: ${input.scannedValue}` : null,
    input.assetName || input.assetTag ? `Asset: ${[input.assetTag, input.assetName].filter(Boolean).join(" / ")}` : null,
    input.expectedLocation ? `Expected location: ${input.expectedLocation}` : null,
    input.currentLocation ? `Current location: ${input.currentLocation}` : null,
    input.timestamp ? `Timestamp: ${formatDateTime(input.timestamp)}` : null,
    `Audit link: /audits/${input.audit.id}`,
  ].filter(Boolean).join("\n");
  return { title: `${titlePrefix[input.type]}: ${target}`, notes };
}

export function auditFindingTaskHref(input: Parameters<typeof auditFindingTaskDetails>[0] & { relatedDeviceId?: string | null }) {
  const details = auditFindingTaskDetails(input);
  const params = new URLSearchParams({ title: details.title, category: "INVENTORY", notes: details.notes });
  if (input.relatedDeviceId) params.set("relatedDeviceId", input.relatedDeviceId);
  return `/tasks/new?${params.toString()}`;
}

export function findScanMatches(value: string, devices: AuditScanDevice[]) {
  const parsed = parseScannedLabel(value);
  const terms = [...new Set([parsed.raw, parsed.query, parsed.assetTag, parsed.serialNumber, parsed.deviceName].filter(Boolean).map(String))];
  const normalizedTerms = new Set(terms.map((term) => normalizedAliasCompare(term)));
  return devices.filter((device) => {
    const candidates = [device.assetTag, device.serialNumber, device.name, ...(device.aliases ?? []).map((alias) => alias.value)].filter(Boolean).map(String);
    return candidates.some((candidate) => normalizedTerms.has(normalizedAliasCompare(candidate)));
  });
}

export function classifyAuditScan(input: {
  session: Pick<InventoryAuditSession, "area" | "department" | "location" | "category">;
  matchedDevices: AuditScanDevice[];
  expectedItems: Array<Pick<InventoryAuditExpectedItem, "deviceId" | "resultStatus">>;
  previousScans: Array<Pick<InventoryAuditScan, "matchedDeviceId" | "resultType">>;
}): { resultType: InventoryAuditScanResult; matchedDevice?: AuditScanDevice | null; expectedItemDeviceId?: string | null; message: string } {
  if (input.matchedDevices.length > 1) return { resultType: "NEEDS_REVIEW", matchedDevice: null, message: "Scan matched multiple assets. Review alias conflicts before counting it." };
  const matchedDevice = input.matchedDevices[0];
  if (!matchedDevice) return { resultType: "UNKNOWN_LABEL", matchedDevice: null, message: "Unknown or unlinked label." };

  const previous = input.previousScans.find((scan) => scan.matchedDeviceId === matchedDevice.id && scan.resultType !== "IGNORED");
  if (previous) return { resultType: "DUPLICATE_SCAN", matchedDevice, expectedItemDeviceId: matchedDevice.id, message: "Already scanned." };

  const expectedItem = input.expectedItems.find((item) => item.deviceId === matchedDevice.id);
  if (expectedItem) return { resultType: "FOUND_EXPECTED", matchedDevice, expectedItemDeviceId: matchedDevice.id, message: "Found expected asset." };

  if (assetMatchesAuditScope(matchedDevice, input.session)) return { resultType: "FOUND_NOT_EXPECTED", matchedDevice, message: "Found real asset in scope, but it was not in the audit snapshot." };
  return { resultType: "FOUND_WRONG_AREA", matchedDevice, message: "Found real asset that belongs somewhere else." };
}

export async function scanAuditLabel(auditSessionId: string, scannedValue: string) {
  const value = scannedValue.trim();
  if (!value) throw new ClientInputError("Scanned value is required.", 422);
  const session = await prisma.inventoryAuditSession.findUnique({
    where: { id: auditSessionId },
    include: { expectedItems: true, scans: true },
  });
  if (!session) throw new ClientInputError("Audit not found.", 404);
  if (session.status !== "ACTIVE") throw new ClientInputError("Only active audits can accept scans.", 422);

  const parsed = parseScannedLabel(value);
  const terms = [...new Set([parsed.raw, parsed.query, parsed.assetTag, parsed.serialNumber, parsed.deviceName].filter(Boolean).map(String))];
  const devices = terms.length
    ? await prisma.device.findMany({
        where: {
          OR: terms.flatMap((term) => [
            { assetTag: term },
            { serialNumber: term },
            { name: term },
            { aliases: { some: { value: term } } },
          ]),
        },
        include: { aliases: { select: { aliasType: true, value: true } } },
        take: 20,
      })
    : [];
  const matchedDevices = findScanMatches(value, devices);
  const classification = classifyAuditScan({ session, matchedDevices, expectedItems: session.expectedItems, previousScans: session.scans });

  const result = await prisma.$transaction(async (tx) => {
    if (classification.resultType === "FOUND_EXPECTED" && classification.expectedItemDeviceId) {
      await tx.inventoryAuditExpectedItem.updateMany({
        where: { auditSessionId, deviceId: classification.expectedItemDeviceId },
        data: { resultStatus: "FOUND" },
      });
    }

    const scan = await tx.inventoryAuditScan.create({
      data: {
        auditSessionId,
        scannedValue: value,
        normalizedValue: normalizedAliasCompare(value),
        matchedDeviceId: classification.matchedDevice?.id,
        resultType: classification.resultType,
        notes: classification.message,
      },
      include: { matchedDevice: true },
    });

    return scan;
  });

  const updated = await prisma.inventoryAuditSession.findUniqueOrThrow({
    where: { id: auditSessionId },
    include: { expectedItems: true, scans: true },
  });
  return { scan: result, classification, progress: auditProgress(updated.expectedItems, updated.scans) };
}

export async function closeAuditSession(auditSessionId: string, status: InventoryAuditSessionStatus = "CLOSED") {
  const session = await prisma.inventoryAuditSession.findUnique({ where: { id: auditSessionId }, include: { expectedItems: true, scans: true } });
  if (!session) throw new ClientInputError("Audit not found.", 404);
  if (!["ACTIVE", "REVIEW"].includes(session.status)) throw new ClientInputError("Only active or review audits can be closed.", 422);
  const nextStatus: InventoryAuditSessionStatus = status === "REVIEW" ? "REVIEW" : "CLOSED";

  return prisma.$transaction(async (tx) => {
    await tx.inventoryAuditExpectedItem.updateMany({
      where: { auditSessionId, resultStatus: "PENDING" },
      data: { resultStatus: "MISSING" },
    });
    const updated = await tx.inventoryAuditSession.update({
      where: { id: auditSessionId },
      data: { status: nextStatus, completedAt: nextStatus === "CLOSED" ? new Date() : null },
      include: { expectedItems: true, scans: true },
    });
    const progress = auditProgress(updated.expectedItems, updated.scans);
    await tx.activityLog.create({
      data: {
        action: nextStatus === "CLOSED" ? "audit.closed" : "audit.review",
        entity: "inventory-audit",
        entityId: auditSessionId,
        message: `${updated.auditNumber ?? "Audit"} ${nextStatus === "CLOSED" ? "closed" : "moved to review"}: ${progress.found}/${progress.expected} found.`,
        metadata: JSON.stringify(progress),
      },
    });
    return { session: updated, progress };
  });
}

export function auditScopeLabel(session: Pick<InventoryAuditSession, "scopeType" | "area" | "department" | "location" | "category">) {
  const parts = [session.area, session.department, session.location, session.category?.replaceAll("_", " ")].filter(Boolean);
  return parts.length ? parts.join(" / ") : session.scopeType.replaceAll("_", " ");
}

function expectedItemExportRow(session: AuditExportSession, item: AuditExportExpectedItem, resultType: string) {
  return {
    auditNumber: session.auditNumber,
    title: session.title,
    assetTag: item.expectedAssetTag ?? item.device?.assetTag ?? "",
    scannedValue: "",
    assetName: item.expectedDisplayName || item.device?.name || "",
    serialNumber: item.device?.serialNumber ?? "",
    category: String(item.expectedCategory ?? item.device?.category ?? ""),
    expectedLocation: item.expectedLocation ?? "",
    currentLocation: item.device?.location || item.device?.areaDepartment || "",
    status: item.device?.status ?? item.expectedStatus ?? "",
    resultType,
    scanTime: "",
    notes: item.resultStatus === "PENDING" ? "Not scanned yet." : "",
  };
}

function scanExportRow(session: AuditExportSession, scan: AuditExportScan, originalScanAt?: Date | string | null) {
  return {
    auditNumber: session.auditNumber,
    title: session.title,
    assetTag: scan.matchedDevice?.assetTag ?? "",
    scannedValue: scan.scannedValue,
    assetName: scan.matchedDevice?.name ?? "",
    serialNumber: scan.matchedDevice?.serialNumber ?? "",
    category: scan.matchedDevice?.category ?? "",
    expectedLocation: "",
    currentLocation: scan.matchedDevice?.location || scan.matchedDevice?.areaDepartment || "",
    status: scan.matchedDevice?.status ?? "",
    resultType: scan.resultType,
    scanTime: formatDateTime(scan.scannedAt),
    originalScanTime: formatDateTime(originalScanAt),
    notes: scan.notes ?? "",
  };
}

function originalScanTime(scans: AuditExportScan[], duplicateScan: AuditExportScan) {
  if (!duplicateScan.matchedDeviceId) return null;
  const duplicateScanAt = new Date(duplicateScan.scannedAt).getTime();
  return scans
    .filter((scan) => scan.id !== duplicateScan.id && scan.matchedDeviceId === duplicateScan.matchedDeviceId && scan.resultType !== "IGNORED" && new Date(scan.scannedAt).getTime() <= duplicateScanAt)
    .sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime())[0]?.scannedAt ?? null;
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function normalizeScopeType(value: unknown): InventoryAuditScopeType {
  if (value === "CATEGORY" || value === "AREA_CATEGORY" || value === "CUSTOM") return value;
  return "AREA_LOCATION";
}

function clean(value: unknown) {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ");
  return trimmed || null;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
