import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { reverse } from "node:dns/promises";
import { platform } from "node:os";
import { ipToNumber, numberToIp, rangeSize, validateIpRange } from "./ip";

const execFileAsync = promisify(execFile);

export type ScanIpResult = {
  ipAddress: string;
  reachable: boolean;
  macAddress?: string | null;
  hostname?: string | null;
  note?: string | null;
  seenAt: Date;
};

async function pingIp(ipAddress: string, timeoutMs: number): Promise<{ reachable: boolean; note?: string }> {
  const isWindows = platform() === "win32";
  const args = isWindows
    ? ["-n", "1", "-w", String(timeoutMs), ipAddress]
    : ["-c", "1", "-W", String(Math.max(1, Math.ceil(timeoutMs / 1000))), ipAddress];

  try {
    await execFileAsync("ping", args, { timeout: timeoutMs + 1000 });
    return { reachable: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ping failed.";
    return { reachable: false, note: message.slice(0, 180) };
  }
}

async function getArpMac(ipAddress: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("arp", ["-a", ipAddress], { timeout: 1200 });
    const match = stdout.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
    return match?.[0]?.replace(/-/g, ":").toUpperCase() ?? null;
  } catch {
    return null;
  }
}

async function getHostname(ipAddress: string): Promise<string | null> {
  try {
    const [hostname] = await reverse(ipAddress);
    return hostname ?? null;
  } catch {
    return null;
  }
}

export async function scanIpRange(
  startIp: string,
  endIp: string,
  options: { timeoutMs: number; maxScanSize: number },
): Promise<{ ok: true; results: ScanIpResult[]; message?: string } | { ok: false; message: string }> {
  const rangeValidation = validateIpRange(startIp, endIp);
  if (!rangeValidation.ok) return { ok: false, message: rangeValidation.message };

  const size = rangeSize(startIp, endIp);
  if (size > options.maxScanSize) {
    return {
      ok: false,
      message: `Scan size is ${size} addresses. The current safety limit is ${options.maxScanSize}. Increase it in Settings if needed.`,
    };
  }

  const results: ScanIpResult[] = [];
  const start = ipToNumber(startIp);
  const end = ipToNumber(endIp);

  for (let current = start; current <= end; current += 1) {
    const ipAddress = numberToIp(current);
    const ping = await pingIp(ipAddress, options.timeoutMs);
    const [macAddress, hostname] = ping.reachable
      ? await Promise.all([getArpMac(ipAddress), getHostname(ipAddress)])
      : [null, null];

    results.push({
      ipAddress,
      reachable: ping.reachable,
      macAddress,
      hostname,
      note: ping.note,
      seenAt: new Date(),
    });
  }

  return { ok: true, results };
}
