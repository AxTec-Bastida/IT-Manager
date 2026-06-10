import { describe, expect, it } from "vitest";
import { getMacDiscoveryLimitationsMessage, parseArpTableOutput, parseGetNetNeighborOutput } from "@/lib/mac-discovery";

describe("MAC discovery parsing", () => {
  it("parses Windows arp output and normalizes the MAC address", () => {
    const output = `
Interface: 192.168.163.10 --- 0x7
  Internet Address      Physical Address      Type
  192.168.163.21        aa-bb-cc-dd-ee-ff     dynamic
`;
    expect(parseArpTableOutput(output, "192.168.163.21")).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("parses Get-NetNeighbor output and normalizes the MAC address", () => {
    const output = `
IPAddress       LinkLayerAddress      State
---------       ----------------      -----
192.168.163.22  11-22-33-44-55-66     Reachable
`;
    expect(parseGetNetNeighborOutput(output, "192.168.163.22")).toBe("11:22:33:44:55:66");
  });

  it("returns null when the requested IP is not present", () => {
    expect(parseArpTableOutput("192.168.163.30 aa-bb-cc-dd-ee-ff dynamic", "192.168.163.21")).toBeNull();
  });

  it("explains ARP detection limitations clearly", () => {
    expect(getMacDiscoveryLimitationsMessage()).toContain("Could not detect MAC");
    expect(getMacDiscoveryLimitationsMessage()).toContain("Enter MAC manually");
  });
});
