import { isIpInRange, normalizeMacAddress, validateIPv4 } from "@/lib/ip";
import { isInstallEligibleAsset, suggestInstallRange, suggestNextIpForRange, type InstallAsset, type InstallRange } from "@/lib/equipment-install";

export type MoveAsset = InstallAsset & {
  areaDepartment?: string | null;
  assignedTo?: string | null;
  employee?: { fullName: string } | null;
  ipRangeId?: string | null;
};

export type MoveInput = {
  area?: unknown;
  department?: unknown;
  location?: unknown;
  notes?: unknown;
  mapAnchorId?: unknown;
  keepCurrentIp?: unknown;
  confirmWarnings?: unknown;
  markActive?: unknown;
};

export type NormalizedMoveInput = {
  area: string | null;
  department: string | null;
  location: string | null;
  areaDepartment: string | null;
  notes: string | null;
  mapAnchorId: string | null;
  keepCurrentIp: boolean;
  confirmWarnings: boolean;
  markActive: boolean;
};

export type MoveWarning = {
  type: "STATUS_REVIEW" | "RANGE_REVIEW" | "DUPLICATE_IP" | "DUPLICATE_MAC" | "MISSING_IP" | "MISSING_MAC" | "NETWORK_REVIEW";
  severity: "info" | "warning" | "blocking";
  message: string;
  conflictingDeviceId?: string;
  conflictingDeviceName?: string;
  suggestedIp?: string | null;
};

export class MoveInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoveInputError";
  }
}

const moveDefaultCategories = new Set(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "SCANNER", "DESKTOP", "ACCESS_POINT", "SWITCH", "CAMERA", "NVR", "CAMERA_NVR", "DOCKING_STATION"]);
const mobileCategories = new Set(["PHONE", "TABLET"]);
const unusualMoveStatuses = new Set(["LOANED_OUT", "IN_REPAIR_RMA", "LOST", "MISSING", "RETIRED", "DISPOSED"]);

export function isMoveUsefulAsset(asset: Pick<MoveAsset, "category" | "location" | "areaDepartment" | "usesStaticIp" | "isFixedAsset" | "ipAddress" | "macAddress">) {
  if (moveDefaultCategories.has(asset.category)) return true;
  const hasPlacementOrNetwork = Boolean(asset.location || asset.areaDepartment || asset.usesStaticIp || asset.isFixedAsset || asset.ipAddress || asset.macAddress);
  if (mobileCategories.has(asset.category)) return hasPlacementOrNetwork;
  if (asset.category === "LAPTOP" || asset.category === "MONITOR" || asset.category === "OTHER") return hasPlacementOrNetwork;
  return hasPlacementOrNetwork;
}

export function isMoveNetworkRelevant(asset: Pick<MoveAsset, "category" | "usesStaticIp" | "isFixedAsset" | "ipAddress" | "macAddress">) {
  return isInstallEligibleAsset(asset) || Boolean(asset.usesStaticIp || asset.isFixedAsset || asset.ipAddress || asset.macAddress);
}

export function normalizeMoveInput(input: MoveInput): NormalizedMoveInput {
  const area = clean(input.area);
  const department = clean(input.department);
  const location = clean(input.location);
  if (!area && !department && !location) throw new MoveInputError("Enter at least one new area, department, or station/location.");
  return {
    area: area || null,
    department: department || null,
    location: location || null,
    areaDepartment: [area, department].filter(Boolean).join(" / ") || null,
    notes: clean(input.notes) || null,
    mapAnchorId: clean(input.mapAnchorId) || null,
    keepCurrentIp: bool(input.keepCurrentIp),
    confirmWarnings: bool(input.confirmWarnings),
    markActive: bool(input.markActive),
  };
}

export function buildMoveWarnings(asset: MoveAsset, input: NormalizedMoveInput, devices: MoveAsset[], ranges: InstallRange[] = []) {
  const warnings: MoveWarning[] = [];
  const networkRelevant = isMoveNetworkRelevant(asset);
  const areaHint = input.areaDepartment || input.location;
  const expectedRange = networkRelevant ? suggestInstallRange(asset, ranges, areaHint) : null;

  if (unusualMoveStatuses.has(asset.status)) {
    warnings.push({
      type: "STATUS_REVIEW",
      severity: "blocking",
      message: `This asset status is ${asset.status.replaceAll("_", " ")}. Confirm the move is intentional because relocation will not change assignment, loan, RMA, lost, or retired state.`,
    });
  }

  if (!networkRelevant) return { warnings, expectedRange, suggestion: null };

  if (!asset.ipAddress && (asset.usesStaticIp || asset.isFixedAsset || isInstallEligibleAsset(asset))) {
    warnings.push({ type: "MISSING_IP", severity: "warning", message: "This static/network asset has no IP recorded. Move can continue, but network setup may need review." });
  }

  if (!asset.macAddress && (asset.usesStaticIp || asset.isFixedAsset || isInstallEligibleAsset(asset))) {
    warnings.push({ type: "MISSING_MAC", severity: "warning", message: "This static/network asset has no MAC recorded. Capture MAC from the equipment label or Install / Commission when practical." });
  }

  if (asset.ipAddress) {
    const duplicate = devices.find((device) => device.id !== asset.id && device.ipAddress?.trim() === asset.ipAddress && !["RETIRED", "DISPOSED", "LOST"].includes(device.status));
    if (duplicate) {
      warnings.push({
        type: "DUPLICATE_IP",
        severity: "blocking",
        message: `${asset.ipAddress} is also assigned to ${duplicate.name}. Review before trusting the network placement.`,
        conflictingDeviceId: duplicate.id,
        conflictingDeviceName: duplicate.name,
      });
    }
  }

  const mac = normalizeMacAddress(asset.macAddress);
  if (mac) {
    const duplicate = devices.find((device) => device.id !== asset.id && normalizeMacAddress(device.macAddress) === mac && !["RETIRED", "DISPOSED", "LOST"].includes(device.status));
    if (duplicate) {
      warnings.push({
        type: "DUPLICATE_MAC",
        severity: "blocking",
        message: `${mac} is also assigned to ${duplicate.name}. Review before trusting the network placement.`,
        conflictingDeviceId: duplicate.id,
        conflictingDeviceName: duplicate.name,
      });
    }
  }

  if (asset.ipAddress && expectedRange && validateIPv4(asset.ipAddress).ok && !isIpInRange(asset.ipAddress, expectedRange.startIp, expectedRange.endIp)) {
    const suggestion = suggestNextIpForRange(expectedRange, devices, asset.id);
    warnings.push({
      type: "RANGE_REVIEW",
      severity: "warning",
      message: `${asset.ipAddress} does not fit the expected ${expectedRange.name} range for this category/location (${expectedRange.startIp} - ${expectedRange.endIp}). Keep current IP if the network is intentionally unchanged, or open Install / Commission.`,
      suggestedIp: suggestion.ip,
    });
  }

  if (asset.ipAddress && expectedRange && asset.vlan != null && asset.vlan !== expectedRange.vlan) {
    warnings.push({
      type: "NETWORK_REVIEW",
      severity: "warning",
      message: `Current VLAN ${asset.vlan} does not match expected VLAN ${expectedRange.vlan} for ${expectedRange.name}. Move can continue, but network setup should be reviewed.`,
    });
  }

  return { warnings, expectedRange, suggestion: expectedRange ? suggestNextIpForRange(expectedRange, devices, asset.id) : null };
}

export function moveRequiresConfirmation(warnings: MoveWarning[]) {
  return warnings.some((warning) => warning.severity === "blocking");
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function bool(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}
