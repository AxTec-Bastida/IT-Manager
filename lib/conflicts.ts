import type { ConflictSeverity, ConflictType, Device, IpRange } from "@prisma/client";
import { activeInventoryStatuses } from "./constants";
import { isIpInRange, normalizeMacAddress, validateIPv4 } from "./ip";

type DeviceWithRange = Device & { ipRange: IpRange | null };

export type ConflictCandidate = {
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  description: string;
  affectedDeviceIds?: string[];
  affectedIps?: string[];
  suggestedFix: string;
};

function groupBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function detectInventoryConflicts(devices: DeviceWithRange[]): ConflictCandidate[] {
  const relevantDevices = devices.filter((device) => activeInventoryStatuses.includes(device.status));
  const conflicts: ConflictCandidate[] = [];

  for (const [ip, matches] of groupBy(relevantDevices, (device) => device.ipAddress?.trim()).entries()) {
    if (matches.length > 1) {
      conflicts.push({
        type: "DUPLICATE_IP",
        severity: "HIGH",
        title: `Duplicate IP ${ip}`,
        description: `${matches.length} active/reserved devices are assigned ${ip}.`,
        affectedDeviceIds: matches.map((device) => device.id),
        affectedIps: [ip],
        suggestedFix: "Move one device to the next available IP in the proper reserved range.",
      });
    }
  }

  for (const [mac, matches] of groupBy(
    relevantDevices.filter((device) => device.status === "ACTIVE"),
    (device) => normalizeMacAddress(device.macAddress),
  ).entries()) {
    if (matches.length > 1) {
      conflicts.push({
        type: "DUPLICATE_MAC",
        severity: "HIGH",
        title: `Duplicate MAC ${mac}`,
        description: `${matches.length} active devices share the same MAC address.`,
        affectedDeviceIds: matches.map((device) => device.id),
        suggestedFix: "Verify labels or switch/UniFi client data, then correct the duplicate MAC entry.",
      });
    }
  }

  for (const [, matches] of groupBy(relevantDevices, (device) => device.name.trim().toLowerCase()).entries()) {
    if (matches.length > 1) {
      conflicts.push({
        type: "DUPLICATE_DEVICE_NAME",
        severity: "MEDIUM",
        title: `Duplicate name ${matches[0].name}`,
        description: `${matches.length} active/reserved devices use the same device name.`,
        affectedDeviceIds: matches.map((device) => device.id),
        suggestedFix: "Rename devices to match the warehouse naming convention and physical labels.",
      });
    }
  }

  for (const device of relevantDevices) {
    if (!device.ipRange) continue;

    if (device.ipAddress && validateIPv4(device.ipAddress).ok && !isIpInRange(device.ipAddress, device.ipRange.startIp, device.ipRange.endIp)) {
      conflicts.push({
        type: "OUTSIDE_RANGE",
        severity: "MEDIUM",
        title: `${device.name} is outside ${device.ipRange.name}`,
        description: `${device.ipAddress} is not inside ${device.ipRange.startIp} - ${device.ipRange.endIp}.`,
        affectedDeviceIds: [device.id],
        affectedIps: device.ipAddress ? [device.ipAddress] : [],
        suggestedFix: "Assign the device to the correct pool or update the IP to an address in the selected pool.",
      });
    }

    if (device.vlan != null && device.vlan !== device.ipRange.vlan) {
      conflicts.push({
        type: "VLAN_MISMATCH",
        severity: "MEDIUM",
        title: `${device.name} VLAN mismatch`,
        description: `Device VLAN ${device.vlan} does not match ${device.ipRange.name} VLAN ${device.ipRange.vlan}.`,
        affectedDeviceIds: [device.id],
        affectedIps: device.ipAddress ? [device.ipAddress] : [],
        suggestedFix: "Correct the inventory VLAN or move the device to a matching reserved range.",
      });
    }
  }

  return conflicts;
}

export function serializeList(values?: string[]) {
  return values && values.length > 0 ? JSON.stringify(values) : null;
}

export function parseList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
