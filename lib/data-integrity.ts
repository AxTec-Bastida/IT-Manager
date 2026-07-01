import { validateIPv4 } from "@/lib/ip";

type DuplicateRecord = {
  id: string;
  assetTag?: string | null;
  serialNumber?: string | null;
};

type MobileTrackingRecord = {
  id: string;
  category: string;
  ipAddress?: string | null;
  macAddress?: string | null;
  usesStaticIp?: boolean;
  movementAlertsEnabled?: boolean;
};

export function detectDuplicateExactValues(records: DuplicateRecord[]) {
  return {
    assetTagDuplicates: duplicatesBy(records, "assetTag"),
    serialDuplicates: duplicatesBy(records, "serialNumber"),
  };
}

export function detectInvalidIps(records: Array<{ id: string; ipAddress?: string | null }>) {
  return records.filter((record) => record.ipAddress && !validateIPv4(record.ipAddress).ok).map((record) => ({ id: record.id, ipAddress: record.ipAddress! }));
}

export function detectNegativeStock(records: Array<{ id: string; quantityOnHand: number }>) {
  return records.filter((record) => record.quantityOnHand < 0).map((record) => ({ id: record.id, quantityOnHand: record.quantityOnHand }));
}

export function detectMobileTrackingViolations(records: MobileTrackingRecord[]) {
  return records
    .filter((record) => ["PHONE", "IPOD", "IPHONE", "IPAD", "TABLET"].includes(record.category))
    .flatMap((record) => {
      if (record.ipAddress || record.macAddress) return [{ id: record.id, reason: "IP/MAC present" }];
      if (record.usesStaticIp || record.movementAlertsEnabled) return [{ id: record.id, reason: "Network tracking enabled" }];
      return [];
    });
}

function duplicatesBy<T extends DuplicateRecord>(records: T[], key: "assetTag" | "serialNumber") {
  const groups = new Map<string, string[]>();
  for (const record of records) {
    const value = String(record[key] ?? "").trim();
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), record.id]);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([value, ids]) => ({ value, ids }));
}
