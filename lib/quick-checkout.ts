import { blockedAssetLoanStatuses } from "@/lib/asset-loans";

export type QuickCheckoutAssetLike = {
  id: string;
  name: string;
  assetTag?: string | null;
  status: string;
  employeeId?: string | null;
  assignedTo?: string | null;
  employee?: { fullName: string } | null;
  rmaItems?: unknown[];
  assetLoanItems?: unknown[];
};

export function quickCheckoutHrefForAsset(assetId: string) {
  return `/loans/quick-checkout?assetId=${encodeURIComponent(assetId)}`;
}

export function quickCheckoutHrefForEmployee(employeeId: string) {
  return `/loans/quick-checkout?borrowerType=employee&borrowerId=${encodeURIComponent(employeeId)}`;
}

export function quickCheckoutHrefForTemporaryBorrower(borrowerId: string) {
  return `/loans/quick-checkout?borrowerType=temporary&borrowerId=${encodeURIComponent(borrowerId)}`;
}

export function expectedReturnDate(daysFromToday = 3, now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

export function quickCheckoutAssetWarning(asset: QuickCheckoutAssetLike) {
  if (blockedAssetLoanStatuses.includes(asset.status as never)) {
    return `${asset.assetTag || asset.name} cannot be loaned because its status is ${asset.status.replaceAll("_", " ")}.`;
  }
  if ((asset.assetLoanItems?.length ?? 0) > 0) return `${asset.assetTag || asset.name} is already loaned out.`;
  if ((asset.rmaItems?.length ?? 0) > 0) return `${asset.assetTag || asset.name} is currently in RMA.`;
  return null;
}

export function canAddQuickCheckoutAsset(asset: QuickCheckoutAssetLike, selectedIds: Iterable<string>) {
  const selected = new Set(selectedIds);
  if (selected.has(asset.id)) return { ok: false as const, message: "This asset is already selected." };
  const warning = quickCheckoutAssetWarning(asset);
  if (warning) return { ok: false as const, message: warning };
  return { ok: true as const };
}

export function hasAssignedAssetWarning(assets: QuickCheckoutAssetLike[]) {
  return assets.some((asset) => Boolean(asset.employeeId || asset.assignedTo || asset.employee?.fullName));
}
