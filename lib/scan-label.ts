import { normalizeMacAddress, validateIPv4 } from "./ip";

export type ParsedScan = {
  raw: string;
  query: string;
  ipAddress?: string;
  macAddress?: string;
  serialNumber?: string;
  deviceName?: string;
  assetTag?: string;
  fields: Record<string, string>;
};

const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const macPattern = /\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b|\b[0-9a-f]{12}\b/i;
type KnownScanField = "ipAddress" | "macAddress" | "serialNumber" | "deviceName" | "assetTag";

const keyAliases: Record<string, KnownScanField> = {
  ip: "ipAddress",
  ipaddress: "ipAddress",
  address: "ipAddress",
  mac: "macAddress",
  macaddress: "macAddress",
  serial: "serialNumber",
  serialnumber: "serialNumber",
  sn: "serialNumber",
  name: "deviceName",
  devicename: "deviceName",
  hostname: "deviceName",
  asset: "assetTag",
  assettag: "assetTag",
  tag: "assetTag",
};

function cleanKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function assignKnownField(parsed: ParsedScan, key: string, value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return;
  const text = String(value).trim();
  if (!text) return;
  const alias = keyAliases[cleanKey(key)];
  if (!alias) return;
  parsed.fields[alias] = text;
}

function parseKeyValueText(raw: string, parsed: ParsedScan) {
  const pairs = raw.split(/[;\n\r|,]+/);
  for (const pair of pairs) {
    const match = pair.match(/^\s*([^:=]+)\s*[:=]\s*(.+?)\s*$/);
    if (match) assignKnownField(parsed, match[1], match[2]);
  }
}

export function parseScannedLabel(rawValue: string): ParsedScan {
  const raw = rawValue.trim();
  const parsed: ParsedScan = { raw, query: raw, fields: {} };

  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(json)) assignKnownField(parsed, key, value);
  } catch {
    parseKeyValueText(raw, parsed);
  }

  const ip = parsed.fields.ipAddress ?? raw.match(ipPattern)?.[0];
  if (ip && validateIPv4(ip).ok) parsed.ipAddress = ip;

  const mac = parsed.fields.macAddress ?? raw.match(macPattern)?.[0];
  const normalizedMac = normalizeMacAddress(mac);
  if (normalizedMac) parsed.macAddress = normalizedMac;

  parsed.serialNumber = parsed.fields.serialNumber;
  parsed.deviceName = parsed.fields.deviceName;
  parsed.assetTag = parsed.fields.assetTag;

  parsed.query = parsed.ipAddress ?? parsed.macAddress ?? parsed.serialNumber ?? parsed.deviceName ?? parsed.assetTag ?? raw;

  return parsed;
}

export function valueForScanTarget(parsed: ParsedScan, target: "name" | "ipAddress" | "macAddress" | "serialNumber") {
  if (target === "name") return parsed.deviceName ?? parsed.assetTag ?? parsed.raw;
  if (target === "ipAddress") return parsed.ipAddress ?? parsed.raw;
  if (target === "macAddress") return parsed.macAddress ?? parsed.raw;
  return parsed.serialNumber ?? parsed.assetTag ?? parsed.raw;
}
