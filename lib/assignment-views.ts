export type AssignmentViewItem = {
  id?: string;
  returnedAt?: Date | string | null;
  returnStatus?: string | null;
  asset?: {
    id?: string;
    name?: string | null;
    assetTag?: string | null;
    serialNumber?: string | null;
    category?: string | null;
    brand?: string | null;
    model?: string | null;
    location?: string | null;
    condition?: string | null;
    status?: string | null;
    employeeId?: string | null;
    assignedTo?: string | null;
  } | null;
};

export type AssignmentViewRecord = {
  id?: string;
  assignmentNumber?: string | null;
  status?: string | null;
  signatureData?: string | null;
  assignmentDate?: Date | string | null;
  targetType?: string | null;
  targetName?: string | null;
  targetPath?: string | null;
  employee?: {
    id?: string;
    fullName?: string | null;
    employeeId?: string | null;
    department?: string | null;
    site?: string | null;
  } | null;
  items?: AssignmentViewItem[] | null;
};

const activeAssignmentStatuses = new Set(["ACTIVE", "PARTIALLY_RETURNED"]);
const inactiveAssignmentStatuses = new Set(["RETURNED", "CANCELLED"]);

export function isActiveAssignmentItem(item: AssignmentViewItem) {
  return !item.returnedAt && item.returnStatus !== "RETURNED" && item.returnStatus !== "DAMAGED" && item.returnStatus !== "LOST" && item.returnStatus !== "MISSING_ACCESSORIES";
}

export function getActiveAssignmentItems(assignment: AssignmentViewRecord) {
  return (assignment.items ?? []).filter(isActiveAssignmentItem);
}

export function isActiveAssignment(assignment: AssignmentViewRecord) {
  return activeAssignmentStatuses.has(String(assignment.status ?? "")) && getActiveAssignmentItems(assignment).length > 0;
}

export function isHistoricalAssignment(assignment: AssignmentViewRecord) {
  return inactiveAssignmentStatuses.has(String(assignment.status ?? "")) || getActiveAssignmentItems(assignment).length === 0;
}

export function assignmentReturnedAt(assignment: AssignmentViewRecord) {
  const returnedDates = (assignment.items ?? [])
    .map((item) => item.returnedAt)
    .filter(Boolean)
    .map((value) => new Date(value as Date | string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return returnedDates[0] ?? null;
}

export function matchesAssignmentSearch(assignment: AssignmentViewRecord, query?: string | null) {
  const q = clean(query).toLowerCase();
  if (!q) return true;
  const values = [
    assignment.assignmentNumber,
    assignment.status,
    assignment.targetName,
    assignment.targetPath,
    assignment.targetType,
    assignment.employee?.fullName,
    assignment.employee?.employeeId,
    assignment.employee?.department,
    assignment.employee?.site,
    ...(assignment.items ?? []).flatMap((item) => [item.asset?.name, item.asset?.assetTag, item.asset?.serialNumber, item.asset?.model, item.asset?.location, item.asset?.assignedTo]),
  ];
  return values.some((value) => clean(value).toLowerCase().includes(q));
}

export function getAssignmentReviewReasons(assignment: AssignmentViewRecord) {
  const reasons: string[] = [];
  const activeItems = getActiveAssignmentItems(assignment);
  const status = String(assignment.status ?? "");

  if (activeItems.length > 0 && inactiveAssignmentStatuses.has(status)) {
    reasons.push("Returned/cancelled assignment still has active items");
  }
  if (activeItems.length === 0 && activeAssignmentStatuses.has(status)) {
    reasons.push("Active assignment has no active items");
  }
  if (!assignment.signatureData) {
    reasons.push("Missing signature");
  }

  for (const item of activeItems) {
    const asset = item.asset;
    if (!asset) {
      reasons.push("Active item is missing asset details");
      continue;
    }
    if (asset.status && asset.status !== "IN_USE_ASSIGNED") {
      reasons.push(`${asset.assetTag || asset.name || "Asset"} status is ${asset.status.replaceAll("_", " ")}`);
    }
    if (!asset.employeeId && !asset.assignedTo) {
      reasons.push(`${asset.assetTag || asset.name || "Asset"} has no responsibility target on the asset record`);
    }
  }

  return [...new Set(reasons)];
}

export function assignmentResponsibleLabel(assignment: AssignmentViewRecord) {
  return assignment.targetPath || assignment.targetName || assignment.employee?.fullName || "Unknown responsibility target";
}

export function groupActiveAssignmentsByEmployee(assignments: AssignmentViewRecord[]) {
  const groups = new Map<string, { employee: NonNullable<AssignmentViewRecord["employee"]>; responsibleLabel: string; assignments: AssignmentViewRecord[]; activeItems: AssignmentViewItem[] }>();
  for (const assignment of assignments) {
    if (!isActiveAssignment(assignment)) continue;
    const responsibleLabel = assignmentResponsibleLabel(assignment);
    const employee = assignment.employee ?? { id: assignment.targetPath || assignment.targetName || "target", fullName: responsibleLabel, employeeId: assignment.targetType || null, department: null, site: null };
    const key = assignment.employee?.id || assignment.targetPath || assignment.targetName || responsibleLabel;
    const current = groups.get(key) ?? { employee, responsibleLabel, assignments: [], activeItems: [] };
    current.assignments.push(assignment);
    current.activeItems.push(...getActiveAssignmentItems(assignment));
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => clean(a.responsibleLabel).localeCompare(clean(b.responsibleLabel)));
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}
