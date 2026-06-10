import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeInstallMacAddress } from "@/lib/equipment-install";

const execFileAsync = promisify(execFile);

export type MacDiscoveryResult =
  | { ok: true; macAddress: string; source: "ARP_DETECTED"; message: string }
  | { ok: false; message: string };

const noMacMessage = "Could not detect MAC. Device may be offline, on another VLAN, blocked, or not reachable from this server. Enter MAC manually or try again.";

export function parseArpTableOutput(output: string, ipAddress: string) {
  const escaped = ipAddress.replaceAll(".", "\\.");
  const pattern = new RegExp(`\\b${escaped}\\b\\s+([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5}|[0-9a-fA-F]{12})`, "i");
  const match = output.match(pattern);
  return normalizeInstallMacAddress(match?.[1] ?? null);
}

export function parseGetNetNeighborOutput(output: string, ipAddress: string) {
  const escaped = ipAddress.replaceAll(".", "\\.");
  const pattern = new RegExp(`\\b${escaped}\\b[\\s\\S]*?([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5}|[0-9a-fA-F]{12})`, "i");
  const match = output.match(pattern);
  return normalizeInstallMacAddress(match?.[1] ?? null);
}

export function getMacDiscoveryLimitationsMessage() {
  return noMacMessage;
}

export async function detectMacByIp(ipAddress: string): Promise<MacDiscoveryResult> {
  try {
    const arp = await execFileAsync("arp", ["-a", ipAddress], { timeout: 5000, windowsHide: true });
    const mac = parseArpTableOutput(`${arp.stdout}\n${arp.stderr}`, ipAddress);
    if (mac) return { ok: true, macAddress: mac, source: "ARP_DETECTED", message: "MAC detected from the local ARP table." };
  } catch {
    // Fall through to PowerShell neighbor table; both are best-effort only.
  }

  try {
    const ps = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Get-NetNeighbor -IPAddress '${ipAddress}' -ErrorAction SilentlyContinue | Format-List IPAddress,LinkLayerAddress,State`],
      { timeout: 5000, windowsHide: true },
    );
    const mac = parseGetNetNeighborOutput(`${ps.stdout}\n${ps.stderr}`, ipAddress);
    if (mac) return { ok: true, macAddress: mac, source: "ARP_DETECTED", message: "MAC detected from the local neighbor table." };
  } catch {
    // Best-effort detection failed.
  }

  return { ok: false, message: noMacMessage };
}
