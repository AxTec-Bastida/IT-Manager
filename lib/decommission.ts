import type { AppRole, AssetDecommissionReason, DeviceCategory, DeviceStatus } from "@prisma/client";

export const decommissionReasonLabels: Record<AssetDecommissionReason, string> = {
  RETIRED: "Retired",
  DISPOSED: "Disposed",
  RECYCLED: "Recycled",
  LOST: "Lost",
  STOLEN: "Stolen",
  DESTROYED: "Destroyed",
  DONATED: "Donated",
  SOLD: "Sold",
  RETURNED_TO_VENDOR: "Returned to vendor",
  OTHER: "Other",
};

export const notesRequiredReasons = new Set<AssetDecommissionReason>(["LOST", "STOLEN", "DISPOSED", "DESTROYED"]);
export const adminOnlyReasons = new Set<AssetDecommissionReason>(["LOST", "STOLEN", "DESTROYED"]);

export const mobileOrComputerCategories = new Set<DeviceCategory>(["LAPTOP", "DESKTOP", "PHONE", "TABLET"]);
export const peripheralChecklistCategories = new Set<DeviceCategory>(["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "SCANNER", "DOCKING_STATION"]);

export type DecommissionChecklistItem = {
  id: string;
  label: string;
  recommended: boolean;
};

export type DecommissionCheckState = Record<string, boolean>;

export type DecommissionBlocker = {
  type: "ACTIVE_ASSIGNMENT" | "ACTIVE_LOAN" | "ACTIVE_RMA";
  message: string;
  href?: string;
};

export type DecommissionWarning = {
  type:
    | "OPEN_TASKS"
    | "MISSING_PHOTOS"
    | "PAIRED_ASSET"
    | "STATIC_NETWORK_DATA"
    | "MAP_LOCATION"
    | "RECENT_AUDIT"
    | "OTHER";
  message: string;
  href?: string;
};

export type DecommissionReviewInput = {
  id: string;
  name: string;
  category: DeviceCategory;
  status: DeviceStatus;
  ipAddress?: string | null;
  macAddress?: string | null;
  usesStaticIp?: boolean | null;
  isFixedAsset?: boolean | null;
  currentMapAnchorId?: string | null;
  photos?: Array<{ id: string; photoType?: string | null }>;
  assignmentItems?: Array<{ id: string; assignmentId: string; assignment?: { assignmentNumber?: string | null } | null }>;
  assetLoanItems?: Array<{ id: string; loanId: string; loan?: { loanNumber?: string | null } | null }>;
  rmaItems?: Array<{ id: string; rmaCaseId: string; rmaCase?: { rmaNumber?: string | null } | null }>;
  tasks?: Array<{ id: string; title: string; status: string }>;
  sourceRelationships?: Array<{ id: string; status: string; targetDevice?: { assetTag?: string | null; name: string } | null }>;
  targetRelationships?: Array<{ id: string; status: string; sourceDevice?: { assetTag?: string | null; name: string } | null }>;
  auditExpectedItems?: Array<{ id: string; resultStatus?: string | null; auditSession?: { auditNumber?: string | null; title: string } | null }>;
  auditScans?: Array<{ id: string; resultType?: string | null; auditSession?: { auditNumber?: string | null; title: string } | null }>;
};

export function finalStatusForDecommissionReason(reason: AssetDecommissionReason): DeviceStatus {
  if (reason === "DISPOSED") return "DISPOSED";
  if (reason === "LOST" || reason === "STOLEN") return "LOST";
  return "RETIRED";
}

export function canRoleUseDecommissionReason(role: AppRole, reason: AssetDecommissionReason) {
  if (role === "ADMIN") return true;
  if (role !== "IT_STAFF") return false;
  return !adminOnlyReasons.has(reason);
}

export function defaultDecommissionChecklist(category: DeviceCategory): DecommissionChecklistItem[] {
  const shared: DecommissionChecklistItem[] = [
    { id: "asset_tag_confirmed", label: "Asset tag/label confirmed or marked retired", recommended: true },
    { id: "evidence_photo_added", label: "Photos/evidence added or reviewed", recommended: true },
    { id: "factura_warranty_reviewed", label: "Factura/warranty reviewed", recommended: true },
    { id: "approval_notes_added", label: "Approval/notes added", recommended: true },
  ];

  if (mobileOrComputerCategories.has(category)) {
    return [
      { id: "physical_return_confirmed", label: "Device physically returned or confirmed unavailable", recommended: true },
      { id: "assignment_loan_closed", label: "Assignment/loan closed before decommission", recommended: true },
      { id: "user_data_backup_reviewed", label: "User data backed up if needed", recommended: true },
      { id: "local_data_wiped", label: "Local data wiped", recommended: true },
      { id: "management_removed", label: "MDM / management removed if applicable", recommended: true },
      { id: "bitlocker_reviewed", label: "BitLocker/recovery info reviewed if applicable", recommended: true },
      ...shared,
    ];
  }

  if (peripheralChecklistCategories.has(category)) {
    return [
      { id: "configuration_reset", label: "Configuration reset if applicable", recommended: true },
      { id: "network_marked_inactive", label: "Network/IP removed or marked inactive if applicable", recommended: true },
      { id: "accessories_removed", label: "Accessories removed", recommended: true },
      ...shared,
      { id: "vendor_disposal_notes", label: "Vendor/disposal notes added", recommended: true },
    ];
  }

  return shared;
}

export function normalizeChecklistState(raw: unknown, allowedItems: DecommissionChecklistItem[]): DecommissionCheckState {
  const allowed = new Set(allowedItems.map((item) => item.id));
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([key]) => allowed.has(key))
      .map(([key, value]) => [key, value === true || value === "true" || value === "on"]),
  );
}

export function buildDecommissionBlockers(device: DecommissionReviewInput): DecommissionBlocker[] {
  const blockers: DecommissionBlocker[] = [];
  const activeAssignment = device.assignmentItems?.[0];
  if (activeAssignment) {
    blockers.push({
      type: "ACTIVE_ASSIGNMENT",
      message: `Active assignment${activeAssignment.assignment?.assignmentNumber ? ` ${activeAssignment.assignment.assignmentNumber}` : ""} must be returned first.`,
      href: `/assignments/${activeAssignment.assignmentId}`,
    });
  }
  const activeLoan = device.assetLoanItems?.[0];
  if (activeLoan) {
    blockers.push({
      type: "ACTIVE_LOAN",
      message: `Active asset loan${activeLoan.loan?.loanNumber ? ` ${activeLoan.loan.loanNumber}` : ""} must be returned first.`,
      href: `/loans/${activeLoan.loanId}`,
    });
  }
  const activeRma = device.rmaItems?.[0];
  if (activeRma) {
    blockers.push({
      type: "ACTIVE_RMA",
      message: `Active RMA${activeRma.rmaCase?.rmaNumber ? ` ${activeRma.rmaCase.rmaNumber}` : ""} must be closed or received first.`,
      href: `/rma/${activeRma.rmaCaseId}`,
    });
  }
  return blockers;
}

export function buildDecommissionWarnings(device: DecommissionReviewInput): DecommissionWarning[] {
  const warnings: DecommissionWarning[] = [];
  const openTasks = device.tasks?.filter((task) => ["OPEN", "IN_PROGRESS", "WAITING"].includes(task.status)) ?? [];
  if (openTasks.length) warnings.push({ type: "OPEN_TASKS", message: `${openTasks.length} open task(s) still reference this asset.`, href: `/tasks?deviceId=${device.id}` });
  if (!device.photos?.length) warnings.push({ type: "MISSING_PHOTOS", message: "No asset photos are attached. Add evidence before disposal if required.", href: `/devices/${device.id}#photos` });
  const activePairs = [
    ...(device.sourceRelationships ?? []).filter((item) => item.status === "ACTIVE"),
    ...(device.targetRelationships ?? []).filter((item) => item.status === "ACTIVE"),
  ];
  if (activePairs.length) warnings.push({ type: "PAIRED_ASSET", message: `${activePairs.length} active paired/related asset link(s) exist. Review related devices before disposal.` });
  if (device.ipAddress || device.macAddress || device.usesStaticIp || device.isFixedAsset) warnings.push({ type: "STATIC_NETWORK_DATA", message: "Asset still has static/install/network fields. Decommission preserves them for history." });
  if (device.currentMapAnchorId) warnings.push({ type: "MAP_LOCATION", message: "Asset has a current map location. Decommission will not erase map history." });
  const auditFindings = [
    ...(device.auditExpectedItems ?? []).filter((item) => item.resultStatus && item.resultStatus !== "FOUND"),
    ...(device.auditScans ?? []).filter((item) => item.resultType && item.resultType !== "FOUND_EXPECTED"),
  ];
  if (auditFindings.length) warnings.push({ type: "RECENT_AUDIT", message: `${auditFindings.length} audit finding(s) reference this asset. Review audit history if needed.` });
  return warnings;
}

export function validateDecommissionRequest(input: {
  role: AppRole;
  reason: AssetDecommissionReason;
  notes?: string | null;
  blockers?: DecommissionBlocker[];
}) {
  const issues: string[] = [];
  if (!canRoleUseDecommissionReason(input.role, input.reason)) issues.push("This decommission reason requires Admin approval.");
  if (notesRequiredReasons.has(input.reason) && !input.notes?.trim()) issues.push(`${decommissionReasonLabels[input.reason]} requires notes.`);
  if (input.blockers?.length) issues.push("Close active assignment, loan, or RMA records before decommissioning this asset.");
  return issues;
}
