import { findNextAvailableIp, isIpInRange, normalizeMacAddress, validateIPv4 } from "@/lib/ip";

export type InstallAsset = {
  id: string;
  name: string;
  category: string;
  status: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  vlan?: number | null;
  location?: string | null;
  areaDepartment?: string | null;
  usesStaticIp?: boolean | null;
  isFixedAsset?: boolean | null;
};

export type InstallRange = {
  id: string;
  name: string;
  category: string;
  vlan: number;
  startIp: string;
  endIp: string;
  location?: string | null;
  active?: boolean | null;
};

export type InstallConflict = {
  type: "DUPLICATE_IP" | "DUPLICATE_MAC" | "OUTSIDE_RANGE" | "STATUS_WARNING" | "INELIGIBLE";
  severity: "warning" | "blocking";
  message: string;
  conflictingDeviceId?: string;
  conflictingDeviceName?: string;
  suggestedIp?: string | null;
};

export class InstallInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstallInputError";
  }
}

const defaultEligibleCategories = new Set(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "DESKTOP", "ACCESS_POINT", "SWITCH", "CAMERA", "NVR", "CAMERA_NVR"]);
const conditionalEligibleCategories = new Set(["SCANNER", "SLED", "DOCKING_STATION", "LAPTOP", "OTHER", "MONITOR"]);
const mobileCategories = new Set(["PHONE", "IPOD", "IPHONE", "IPAD", "TABLET"]);
const unavailableStatuses = new Set(["RETIRED", "LOST", "DISPOSED", "MISSING", "IN_REPAIR_RMA", "LOANED_OUT"]);

export function isInstallEligibleAsset(asset: Pick<InstallAsset, "category" | "usesStaticIp" | "isFixedAsset" | "ipAddress" | "macAddress">) {
  if (defaultEligibleCategories.has(asset.category)) return true;
  if (mobileCategories.has(asset.category)) return Boolean(asset.usesStaticIp || asset.isFixedAsset);
  if (conditionalEligibleCategories.has(asset.category)) return Boolean(asset.usesStaticIp || asset.isFixedAsset || asset.ipAddress || asset.macAddress);
  return Boolean(asset.usesStaticIp || asset.isFixedAsset || asset.ipAddress || asset.macAddress);
}

export function isValidMacAddress(value?: string | null) {
  if (!value) return false;
  const cleaned = String(value).trim().replace(/[^0-9A-Fa-f]/g, "");
  if (!/^[0-9A-Fa-f]{12}$/.test(cleaned)) return false;
  const normalized = cleaned.toUpperCase();
  return normalized !== "000000000000" && normalized !== "FFFFFFFFFFFF";
}

export function normalizeInstallMacAddress(value?: string | null) {
  if (!value) return null;
  if (!isValidMacAddress(value)) return null;
  return normalizeMacAddress(value);
}

export function installActionLabel(asset: Pick<InstallAsset, "status" | "ipAddress" | "macAddress" | "location" | "areaDepartment" | "usesStaticIp" | "isFixedAsset">) {
  return asset.ipAddress || asset.macAddress || asset.location || asset.areaDepartment || asset.usesStaticIp || asset.isFixedAsset ? "Update Installation" : "Install / Commission";
}

export function normalizeInstallInput(input: {
  location?: unknown;
  areaDepartment?: unknown;
  ipAddress?: unknown;
  macAddress?: unknown;
  vlan?: unknown;
  usesStaticIp?: unknown;
  isFixedAsset?: unknown;
  ipRangeId?: unknown;
  macAddressSource?: unknown;
  macAddressConfidence?: unknown;
  notes?: unknown;
  overrideConflict?: unknown;
}) {
  const ipAddress = clean(input.ipAddress);
  const macAddressRaw = clean(input.macAddress);
  const macAddress = macAddressRaw ? normalizeInstallMacAddress(macAddressRaw) : null;
  const ipValidation = validateIPv4(ipAddress);
  if (ipAddress && !ipValidation.ok) throw new InstallInputError(ipValidation.message);
  if (macAddressRaw && !macAddress) throw new InstallInputError("Enter a valid MAC address like AA:BB:CC:DD:EE:FF.");
  const vlanText = clean(input.vlan);
  const vlan = vlanText ? Number(vlanText) : null;
  if (vlan != null && (!Number.isInteger(vlan) || vlan < 1 || vlan > 4094)) throw new InstallInputError("VLAN must be a number from 1 to 4094.");

  return {
    location: clean(input.location) || null,
    areaDepartment: clean(input.areaDepartment) || null,
    ipAddress: ipAddress || null,
    macAddress,
    vlan,
    usesStaticIp: bool(input.usesStaticIp),
    isFixedAsset: bool(input.isFixedAsset),
    ipRangeId: clean(input.ipRangeId) || null,
    macAddressSource: clean(input.macAddressSource) || (macAddress ? "MANUAL" : "UNKNOWN"),
    macAddressConfidence: clean(input.macAddressConfidence) || (macAddress ? "CONFIRMED" : "NEEDS_REVIEW"),
    notes: clean(input.notes) || null,
    overrideConflict: bool(input.overrideConflict),
  };
}

export function findInstallConflicts(asset: InstallAsset, input: { ipAddress?: string | null; macAddress?: string | null; ipRangeId?: string | null }, devices: InstallAsset[], ranges: InstallRange[] = []) {
  const conflicts: InstallConflict[] = [];
  const ip = input.ipAddress?.trim() || "";
  const mac = normalizeMacAddress(input.macAddress)?.trim() || "";

  if (!isInstallEligibleAsset(asset)) {
    conflicts.push({ type: "INELIGIBLE", severity: "blocking", message: "This asset is not eligible for install/IP commissioning by default. Use normal edit only if network tracking is intentionally enabled." });
  }

  if (unavailableStatuses.has(asset.status)) {
    conflicts.push({ type: "STATUS_WARNING", severity: "blocking", message: `This asset status is ${asset.status.replaceAll("_", " ")}. Resolve loan/RMA/lost/retired state before commissioning, or explicitly override after review.` });
  }

  if (ip) {
    const duplicate = devices.find((device) => device.id !== asset.id && device.ipAddress?.trim() === ip && !["RETIRED", "DISPOSED", "LOST"].includes(device.status));
    if (duplicate) {
      const suggested = input.ipRangeId ? suggestNextIpForRange(ranges.find((range) => range.id === input.ipRangeId) ?? null, devices, asset.id).ip : null;
      conflicts.push({ type: "DUPLICATE_IP", severity: "blocking", message: `${ip} is already assigned to ${duplicate.name}.`, conflictingDeviceId: duplicate.id, conflictingDeviceName: duplicate.name, suggestedIp: suggested });
    }
  }

  if (mac) {
    const duplicate = devices.find((device) => device.id !== asset.id && normalizeMacAddress(device.macAddress) === mac && !["RETIRED", "DISPOSED", "LOST"].includes(device.status));
    if (duplicate) {
      conflicts.push({ type: "DUPLICATE_MAC", severity: "blocking", message: `${mac} is already assigned to ${duplicate.name}.`, conflictingDeviceId: duplicate.id, conflictingDeviceName: duplicate.name });
    }
  }

  if (ip && input.ipRangeId) {
    const range = ranges.find((candidate) => candidate.id === input.ipRangeId);
    if (range && validateIPv4(ip).ok && !isIpInRange(ip, range.startIp, range.endIp)) {
      conflicts.push({ type: "OUTSIDE_RANGE", severity: "blocking", message: `${ip} is outside ${range.name} (${range.startIp} - ${range.endIp}).` });
    }
  }

  return conflicts;
}

export function suggestInstallRange(asset: InstallAsset, ranges: InstallRange[], area?: string | null) {
  const active = ranges.filter((range) => range.active !== false);
  const categoryMatch = active.filter((range) => range.category === asset.category);
  const areaText = clean(area).toLowerCase();
  const areaMatch = areaText ? categoryMatch.find((range) => `${range.name} ${range.location ?? ""}`.toLowerCase().includes(areaText)) : null;
  return areaMatch ?? categoryMatch[0] ?? active.find((range) => range.category === "OTHER") ?? active[0] ?? null;
}

export function suggestNextIpForRange(range: InstallRange | null | undefined, devices: InstallAsset[], excludeDeviceId?: string) {
  if (!range) return { ip: null, reason: "No matching active IP range was found. Choose a range or enter IP manually." };
  const usedIps = devices.filter((device) => device.id !== excludeDeviceId).map((device) => device.ipAddress).filter((value): value is string => Boolean(value));
  const suggestion = findNextAvailableIp(range.startIp, range.endIp, usedIps);
  return { ...suggestion, rangeId: range.id, rangeName: range.name, vlan: range.vlan };
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function bool(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}
