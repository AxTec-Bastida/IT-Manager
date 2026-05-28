import { describe, expect, it } from "vitest";
import { findNextAvailableIp, isIpInRange, validateIPv4, validateIpRange } from "@/lib/ip";

describe("IPv4 validation", () => {
  it("rejects octets above 255", () => {
    expect(validateIPv4("192.168.163.280").ok).toBe(false);
  });

  it("accepts valid IPv4 addresses", () => {
    expect(validateIPv4("192.168.163.25").ok).toBe(true);
  });
});

describe("IP range validation", () => {
  it("rejects backwards ranges", () => {
    expect(validateIpRange("192.168.1.20", "192.168.1.10").ok).toBe(false);
  });

  it("checks membership", () => {
    expect(isIpInRange("192.168.1.15", "192.168.1.10", "192.168.1.20")).toBe(true);
    expect(isIpInRange("192.168.1.25", "192.168.1.10", "192.168.1.20")).toBe(false);
  });
});

describe("next available IP", () => {
  it("returns the first unused IP in the range", () => {
    const suggestion = findNextAvailableIp("192.168.1.10", "192.168.1.12", ["192.168.1.10", "192.168.1.12"]);
    expect(suggestion.ip).toBe("192.168.1.11");
  });

  it("returns null when the range is full", () => {
    const suggestion = findNextAvailableIp("192.168.1.10", "192.168.1.11", ["192.168.1.10", "192.168.1.11"]);
    expect(suggestion.ip).toBeNull();
  });
});
