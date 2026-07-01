import type { DeviceAliasType, DeviceRelationshipStatus, DeviceRelationshipType } from "@prisma/client";

export type MobileLegacyDevice = {
  id: string;
  name: string;
  assetTag: string | null;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  assignedTo?: string | null;
  employeeId?: string | null;
  status?: string | null;
  condition?: string | null;
  notes?: string | null;
  employee?: { fullName: string; employeeId: string | null } | null;
  aliases?: Array<{ aliasType: string; value: string }>;
  sourceRelationships?: Array<{ relationshipType: string; status: string; targetDeviceId: string }>;
  targetRelationships?: Array<{ relationshipType: string; status: string; sourceDeviceId: string }>;
  assignmentItems?: Array<{ returnedAt?: Date | string | null }>;
};

export type DeviceAliasCandidate = {
  deviceId: string;
  aliasType: DeviceAliasType;
  value: string;
  sourceSheet?: string | null;
  sourceColumn?: string | null;
  sourceRow?: number | null;
  notes?: string | null;
};

export type DeviceRelationshipCandidate = {
  sourceDeviceId: string;
  targetDeviceId: string;
  relationshipType: DeviceRelationshipType;
  status: DeviceRelationshipStatus;
  sourceReference?: string | null;
  confidence?: number | null;
  notes?: string | null;
};

export type SuspiciousAssignmentReview = {
  device: MobileLegacyDevice;
  assignedValue: string;
  reason: string;
  suggestedAction: string;
  possibleLinkedAsset?: MobileLegacyDevice | null;
  suggestedAlias?: DeviceAliasCandidate | null;
  suggestedRelationship?: DeviceRelationshipCandidate | null;
};

export type MobilePairingReview = {
  mobileDevice?: MobileLegacyDevice | null;
  sledDevice?: MobileLegacyDevice | null;
  reference: string;
  status: "MATCHED" | "AMBIGUOUS" | "UNMATCHED";
  confidence: number;
  reason: string;
  relationship?: DeviceRelationshipCandidate | null;
};

export type MobilePairingCleanupPlan = {
  suspiciousAssignments: SuspiciousAssignmentReview[];
  aliasesToCreate: DeviceAliasCandidate[];
  pairingsToCreate: DeviceRelationshipCandidate[];
  assignmentsToClear: SuspiciousAssignmentReview[];
  ambiguousPairings: MobilePairingReview[];
};

const placeholderAssignedValues = new Set(["NO ASIGNADO", "NO ASIGNADA", "N/A", "#N/A", "NA", "NONE", "SIN ASIGNAR", "NO ASSIGNED"]);
const activeRelationshipStatuses = new Set(["ACTIVE", "NEEDS_REVIEW"]);

export function normalizeLegacyIdentifier(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

export function normalizedLookupKey(value: unknown) {
  return normalizeLegacyIdentifier(value).toUpperCase();
}

export function isPlaceholderAssignedValue(value: unknown) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  return placeholderAssignedValues.has(normalized);
}

export function isAssetLikeAssignedValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const normalized = text.toUpperCase();
  if (isPlaceholderAssignedValue(text)) return true;
  if (/^(TFG|TFGTI)/i.test(text)) return true;
  if (/^GHT[-_]/i.test(text)) return true;
  if (/\b(GHT-IPO|GHT-IPH|GHT-IPA|GHT-SLD)\b/i.test(text)) return true;
  if (/\b(IPOD|IPHONE|IPAD|SLED|SCANNER|LAPTOP|ACCESS POINT)\b/i.test(normalized)) return true;
  return false;
}

export function isHumanLikeAssignedValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || isAssetLikeAssignedValue(text)) return false;
  if (/^[A-Z]{1,4}$/i.test(text)) return true;
  return /[a-z]+[\s.-]+[a-z]+/i.test(text) || /@/.test(text);
}

export function isMobileOrSledLegacyAsset(device: Pick<MobileLegacyDevice, "assetTag" | "category" | "name" | "model" | "brand" | "notes">) {
  const text = `${device.assetTag ?? ""} ${device.name ?? ""} ${device.model ?? ""} ${device.brand ?? ""} ${device.notes ?? ""}`.toLowerCase();
  return (
    device.category === "PHONE" ||
    device.category === "IPOD" ||
    device.category === "IPHONE" ||
    device.category === "IPAD" ||
    device.category === "TABLET" ||
    device.category === "SLED" ||
    text.includes("source: ipod") ||
    text.includes("source: iphone") ||
    text.includes("source: ipad") ||
    text.includes("source: sled") ||
    text.includes("ipod") ||
    text.includes("iphone") ||
    text.includes("ipad") ||
    text.includes("ght-sld") ||
    text.includes("infinite peripherals") ||
    text.includes("infinea")
  );
}

export function sourceFromLegacyNotes(notes?: string | null) {
  const match = String(notes ?? "").match(/Source:\s*(.*?)\s+row\s+(\d+)/i);
  return match ? { sourceSheet: match[1].trim(), sourceRow: Number(match[2]) } : { sourceSheet: null, sourceRow: null };
}

export function legacyAnFromNotes(notes?: string | null) {
  const match = String(notes ?? "").match(/Legacy A\/N:\s*([^|]+)/i);
  return match ? match[1].trim() : "";
}

export function buildLegacyAliasCandidates(device: MobileLegacyDevice) {
  const source = sourceFromLegacyNotes(device.notes);
  const candidates: DeviceAliasCandidate[] = [];
  const legacyAn = legacyAnFromNotes(device.notes);
  if (legacyAn && legacyAn !== device.assetTag) {
    candidates.push({ deviceId: device.id, aliasType: "OLD_AN", value: legacyAn, sourceSheet: source.sourceSheet, sourceColumn: "Legacy A/N", sourceRow: source.sourceRow });
  }
  if (device.assignedTo && isAssetLikeAssignedValue(device.assignedTo) && !isPlaceholderAssignedValue(device.assignedTo)) {
    candidates.push({
      deviceId: device.id,
      aliasType: device.assignedTo.toUpperCase().startsWith("TFG") ? "LEGACY_ASSET_TAG" : "LEGACY_LABEL",
      value: device.assignedTo.trim(),
      sourceSheet: source.sourceSheet,
      sourceColumn: "Assigned",
      sourceRow: source.sourceRow,
      notes: "Imported assigned value looked like an asset identifier, not a person.",
    });
  }
  return dedupeAliases(candidates);
}

export function buildMobilePairingCleanupPlan(devices: MobileLegacyDevice[]): MobilePairingCleanupPlan {
  const deviceIndex = buildDeviceIndex(devices);
  const suspiciousAssignments: SuspiciousAssignmentReview[] = [];
  const aliasesToCreate: DeviceAliasCandidate[] = [];
  const pairingsToCreate: DeviceRelationshipCandidate[] = [];
  const assignmentsToClear: SuspiciousAssignmentReview[] = [];
  const ambiguousPairings: MobilePairingReview[] = [];
  const existingRelationshipKeys = new Set<string>();
  const existingAliasKeys = new Set<string>();

  for (const device of devices) {
    for (const alias of device.aliases ?? []) {
      existingAliasKeys.add(`${device.id}:${alias.aliasType}:${normalizedLookupKey(alias.value)}`);
    }
    for (const relationship of [...(device.sourceRelationships ?? []), ...(device.targetRelationships ?? [])]) {
      if (activeRelationshipStatuses.has(relationship.status)) {
        const otherDeviceId = "targetDeviceId" in relationship ? relationship.targetDeviceId : relationship.sourceDeviceId;
        existingRelationshipKeys.add(`${device.id}:${otherDeviceId}:${relationship.relationshipType}`);
      }
    }
  }

  for (const device of devices) {
    aliasesToCreate.push(...buildLegacyAliasCandidates(device));
    const assignedValue = String(device.assignedTo ?? "").trim();
    if (!assignedValue || !isAssetLikeAssignedValue(assignedValue)) continue;

    const reason = isPlaceholderAssignedValue(assignedValue)
      ? "Assigned value is a legacy placeholder, not a person."
      : "Assigned value looks like a legacy asset identifier, not a person.";
    const matchedMobile = isPlaceholderAssignedValue(assignedValue) ? null : findReferencedMobileDevice(assignedValue, deviceIndex);
    const relationship = matchedMobile
      ? buildPairingRelationship(matchedMobile, device, assignedValue)
      : null;
    const review: SuspiciousAssignmentReview = {
      device,
      assignedValue,
      reason,
      suggestedAction: relationship ? "Clear fake assignment and create paired asset relationship." : "Clear fake assignment; review pairing manually if needed.",
      possibleLinkedAsset: matchedMobile,
      suggestedAlias: buildLegacyAliasCandidates(device).find((alias) => alias.value === assignedValue) ?? null,
      suggestedRelationship: relationship,
    };
    suspiciousAssignments.push(review);

    if (canClearImportedAssignedValue(device, assignedValue)) assignmentsToClear.push(review);

    if (relationship) {
      const key = `${relationship.sourceDeviceId}:${relationship.targetDeviceId}:${relationship.relationshipType}`;
      if (!existingRelationshipKeys.has(key)) {
        pairingsToCreate.push(relationship);
        existingRelationshipKeys.add(key);
      }
    } else if (!isPlaceholderAssignedValue(assignedValue)) {
      ambiguousPairings.push({
        sledDevice: device,
        reference: assignedValue,
        status: "UNMATCHED",
        confidence: 0,
        reason: "Assigned legacy mobile reference did not match exactly enough to create a relationship.",
      });
    }
  }

  return {
    suspiciousAssignments,
    aliasesToCreate: dedupeAliases(aliasesToCreate).filter((alias) => !existingAliasKeys.has(`${alias.deviceId}:${alias.aliasType}:${normalizedLookupKey(alias.value)}`)),
    pairingsToCreate: dedupeRelationships(pairingsToCreate),
    assignmentsToClear,
    ambiguousPairings,
  };
}

export function canClearImportedAssignedValue(device: MobileLegacyDevice, assignedValue = device.assignedTo ?? "") {
  if (!isMobileOrSledLegacyAsset(device)) return false;
  if (!isAssetLikeAssignedValue(assignedValue)) return false;
  if (device.employeeId || device.employee) return false;
  if (device.assignmentItems?.some((item) => !item.returnedAt)) return false;
  return true;
}

export function mobilePairingStatus(device: MobileLegacyDevice) {
  const pairings = [...(device.sourceRelationships ?? []), ...(device.targetRelationships ?? [])].filter((relationship) =>
    ["PAIRED_WITH", "IPOD_SLED_PAIR", "IPHONE_SLED_PAIR"].includes(relationship.relationshipType) && activeRelationshipStatuses.has(relationship.status),
  );
  if (pairings.length) return "Paired";
  if (isMobilePairExpected(device)) return "Missing Sled Pair";
  if (isAssetLikeAssignedValue(device.assignedTo)) return "Needs Pair Review";
  return "";
}

export function isMobilePairExpected(device: MobileLegacyDevice) {
  const text = `${device.name} ${device.assetTag ?? ""} ${device.model ?? ""} ${device.brand ?? ""} ${device.notes ?? ""}`.toLowerCase();
  if (text.includes("ght-sld") || text.includes("source: sled")) return false;
  return ["PHONE", "IPOD", "IPHONE", "IPAD", "TABLET"].includes(device.category) || text.includes("source: ipod") || text.includes("source: iphone") || text.includes("ght-ipo") || text.includes("ght-iph");
}

function buildPairingRelationship(mobile: MobileLegacyDevice, sled: MobileLegacyDevice, reference: string): DeviceRelationshipCandidate {
  const text = `${mobile.name} ${mobile.assetTag ?? ""} ${mobile.model ?? ""} ${reference}`.toLowerCase();
  const relationshipType: DeviceRelationshipType = text.includes("iphone") || String(mobile.category) === "IPHONE" ? "IPHONE_SLED_PAIR" : "IPOD_SLED_PAIR";
  return {
    sourceDeviceId: mobile.id,
    targetDeviceId: sled.id,
    relationshipType,
    status: "ACTIVE",
    sourceReference: reference,
    confidence: 0.9,
    notes: "Created from legacy Sled assigned value during mobile pairing cleanup.",
  };
}

function findReferencedMobileDevice(value: string, index: ReturnType<typeof buildDeviceIndex>) {
  const keys = mobileReferenceKeys(value);
  const matches = keys.flatMap((key) => index.get(key) ?? []);
  const unique = [...new Map(matches.map((device) => [device.id, device])).values()];
  const desiredType = mobileReferenceType(value);
  const mobileMatches = unique.filter((device) => isMobilePairExpected(device) && (!desiredType || deviceMatchesMobileReferenceType(device, desiredType)));
  if (mobileMatches.length === 1) return mobileMatches[0];
  return unique.length === 1 && isMobilePairExpected(unique[0]) ? unique[0] : null;
}

function mobileReferenceType(value: string) {
  const normalized = normalizedLookupKey(value);
  if (normalized.includes("IPHONE")) return "IPHONE";
  if (normalized.includes("IPAD")) return "IPAD";
  if (normalized.includes("IPOD")) return "IPOD";
  return "";
}

function deviceMatchesMobileReferenceType(device: MobileLegacyDevice, type: string) {
  const text = `${device.name} ${device.assetTag ?? ""} ${device.model ?? ""} ${device.brand ?? ""} ${device.notes ?? ""}`.toUpperCase();
  if (type === "IPHONE") return ["PHONE", "IPHONE"].includes(device.category) || text.includes("IPHONE") || text.includes("GHT-IPH");
  if (type === "IPAD") return text.includes("IPAD") || text.includes("GHT-IPA");
  if (type === "IPOD") return text.includes("IPOD") || text.includes("GHT-IPO");
  return true;
}

export function mobileReferenceKeys(value: string) {
  const normalized = normalizedLookupKey(value);
  const keys = new Set<string>([normalized]);
  const typed = normalized.match(/(?:TFGTI?J?)?(IPOD|IPHONE|IPAD)([A-Z]?)(\d+)$/i);
  if (typed) {
    const [, type, letter, number] = typed;
    const prefix = type.toUpperCase() === "IPHONE" ? "GHT-IPH" : type.toUpperCase() === "IPAD" ? "GHT-IPA" : "GHT-IPO";
    keys.add(`${prefix}-${number}`.toUpperCase());
    keys.add(String(number).toUpperCase());
    if (letter) keys.add(`${letter}${number}`.toUpperCase());
  }
  return [...keys];
}

function buildDeviceIndex(devices: MobileLegacyDevice[]) {
  const index = new Map<string, MobileLegacyDevice[]>();
  const add = (key: unknown, device: MobileLegacyDevice) => {
    const normalized = normalizedLookupKey(key);
    if (!normalized) return;
    index.set(normalized, [...(index.get(normalized) ?? []), device]);
  };
  for (const device of devices) {
    add(device.assetTag, device);
    add(legacyAnFromNotes(device.notes), device);
    for (const alias of device.aliases ?? []) add(alias.value, device);
  }
  return index;
}

function dedupeAliases(candidates: DeviceAliasCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.deviceId}:${candidate.aliasType}:${normalizedLookupKey(candidate.value)}`;
    if (!candidate.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRelationships(candidates: DeviceRelationshipCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.sourceDeviceId}:${candidate.targetDeviceId}:${candidate.relationshipType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
