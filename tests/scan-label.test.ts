import { describe, expect, it } from "vitest";
import { parseScannedLabel, valueForScanTarget } from "@/lib/scan-label";

describe("camera scan label parsing", () => {
  it("extracts IP and MAC from plain label text", () => {
    const parsed = parseScannedLabel("PACK-ZT410-09 192.168.163.29 001122334499");
    expect(parsed.ipAddress).toBe("192.168.163.29");
    expect(parsed.macAddress).toBe("00:11:22:33:44:99");
  });

  it("extracts structured QR key-value fields", () => {
    const parsed = parseScannedLabel("name=PACK-SCALE-10; ip=192.168.164.30; serial=MT-010");
    expect(parsed.deviceName).toBe("PACK-SCALE-10");
    expect(parsed.ipAddress).toBe("192.168.164.30");
    expect(parsed.serialNumber).toBe("MT-010");
  });

  it("fills targeted form fields from parsed values", () => {
    const parsed = parseScannedLabel('{"hostname":"SCAN-CART-02","mac":"84:24:8D:10:20:31"}');
    expect(valueForScanTarget(parsed, "name")).toBe("SCAN-CART-02");
    expect(valueForScanTarget(parsed, "macAddress")).toBe("84:24:8D:10:20:31");
  });
});
