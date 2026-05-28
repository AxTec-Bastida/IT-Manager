export type IpValidationResult = { ok: true } | { ok: false; message: string };

const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

export function validateIPv4(ip: string): IpValidationResult {
  const value = ip.trim();

  if (!ipv4Pattern.test(value)) {
    return { ok: false, message: "Enter a valid IPv4 address like 192.168.10.25." };
  }

  const octets = value.split(".").map(Number);
  const validOctets = octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);

  if (!validOctets) {
    return { ok: false, message: "IPv4 octets must be numbers from 0 to 255." };
  }

  return { ok: true };
}

export function ipToNumber(ip: string): number {
  const result = validateIPv4(ip);
  if (!result.ok) {
    throw new Error(result.message);
  }

  return ip
    .split(".")
    .map(Number)
    .reduce((total, octet) => total * 256 + octet, 0);
}

export function numberToIp(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) {
    throw new Error("IP number is outside the IPv4 address space.");
  }

  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

export function validateIpRange(startIp: string, endIp: string): IpValidationResult {
  const startValid = validateIPv4(startIp);
  if (!startValid.ok) return { ok: false, message: `Start IP: ${startValid.message}` };

  const endValid = validateIPv4(endIp);
  if (!endValid.ok) return { ok: false, message: `End IP: ${endValid.message}` };

  if (ipToNumber(startIp) > ipToNumber(endIp)) {
    return { ok: false, message: "Start IP must be lower than or equal to end IP." };
  }

  return { ok: true };
}

export function isIpInRange(ip: string, startIp: string, endIp: string): boolean {
  const target = ipToNumber(ip);
  return target >= ipToNumber(startIp) && target <= ipToNumber(endIp);
}

export function rangeSize(startIp: string, endIp: string): number {
  return ipToNumber(endIp) - ipToNumber(startIp) + 1;
}

export function normalizeMacAddress(mac?: string | null): string | null {
  if (!mac) return null;
  const cleaned = mac.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
  if (!cleaned) return null;
  if (cleaned.length !== 12) return mac.trim().toUpperCase();
  return cleaned.match(/.{1,2}/g)?.join(":") ?? cleaned;
}

export function findNextAvailableIp(
  startIp: string,
  endIp: string,
  usedIps: string[],
): { ip: string | null; reason: string } {
  const rangeValidation = validateIpRange(startIp, endIp);
  if (!rangeValidation.ok) {
    return { ip: null, reason: rangeValidation.message };
  }

  const used = new Set(
    usedIps
      .filter((ip) => validateIPv4(ip).ok)
      .map((ip) => ipToNumber(ip)),
  );

  for (let current = ipToNumber(startIp); current <= ipToNumber(endIp); current += 1) {
    if (!used.has(current)) {
      const ip = numberToIp(current);
      return {
        ip,
        reason: `${ip} is the first valid address in the pool that is not assigned to an active or reserved inventory record.`,
      };
    }
  }

  return { ip: null, reason: "Every valid IP in this range is already active or reserved." };
}
