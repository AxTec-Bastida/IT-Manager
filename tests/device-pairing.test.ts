import { describe, expect, it } from "vitest";
import { ClientInputError } from "@/lib/api";
import { chargerStatusValues, checkExistingPairing, getPhoneSledRelationshipType, resolvePhoneSledPair } from "@/lib/device-pairing";
import { deviceSchema } from "@/lib/validation";

const ipod = {
  id: "mobile-1",
  name: "iPod Touch",
  assetTag: "GHT-IPO-130",
  category: "PHONE" as const,
  brand: "Apple",
  model: "iPod Touch",
  serialNumber: "IPODSN",
};

const iphone = {
  ...ipod,
  id: "mobile-2",
  name: "iPhone 14",
  assetTag: "GHT-IPH-014",
  model: "iPhone 14",
};

const sled = {
  id: "sled-1",
  name: "Sled GHT-SLD-130",
  assetTag: "GHT-SLD-130",
  category: "OTHER" as const,
  brand: "Infinite Peripherals",
  model: "Infinea X",
  serialNumber: "SLDSN",
};

describe("device phone/sled pairing guardrails", () => {
  it("creates iPod sled pair metadata with mobile as the source device", () => {
    const pair = resolvePhoneSledPair(ipod, sled);
    expect(pair.mobileDevice.id).toBe(ipod.id);
    expect(pair.sledDevice.id).toBe(sled.id);
    expect(pair.relationshipType).toBe("IPOD_SLED_PAIR");
  });

  it("creates iPhone sled pair metadata even when the sled is submitted first", () => {
    const pair = resolvePhoneSledPair(sled, iphone);
    expect(pair.mobileDevice.id).toBe(iphone.id);
    expect(pair.sledDevice.id).toBe(sled.id);
    expect(pair.relationshipType).toBe("IPHONE_SLED_PAIR");
    expect(getPhoneSledRelationshipType(iphone)).toBe("IPHONE_SLED_PAIR");
  });

  it("rejects ambiguous or same-device pairings", () => {
    const laptop = { ...ipod, id: "laptop-1", name: "Dell Latitude", assetTag: "GHT-LP-1", category: "LAPTOP" as const, model: "Latitude 5520" };
    expect(() => resolvePhoneSledPair(laptop, sled)).toThrow(ClientInputError);
    expect(() => resolvePhoneSledPair(ipod, ipod)).toThrow(ClientInputError);
  });

  it("validates charger status values through the device schema", () => {
    expect(chargerStatusValues).toContain("HEALTHY");
    const base = { name: "iPod Touch", category: "PHONE", status: "ACTIVE" };
    expect(deviceSchema.safeParse({ ...base, chargerStatus: "DAMAGED" }).success).toBe(true);
    expect(deviceSchema.safeParse({ ...base, chargerStatus: "BROKEN" }).success).toBe(false);
  });
});

describe("flash pairing helpers", () => {
  it("checkExistingPairing returns not paired when no relationship exists", async () => {
    const prisma = {
      deviceRelationship: {
        findFirst: async () => null,
      },
    };
    const result = await checkExistingPairing(prisma as never, "device-1");
    expect(result.isPaired).toBe(false);
    expect(result.pairedDeviceId).toBeNull();
  });

  it("checkExistingPairing returns paired info when relationship exists", async () => {
    const prisma = {
      deviceRelationship: {
        findFirst: async () => ({
          id: "rel-1",
          sourceDeviceId: "device-1",
          targetDeviceId: "device-2",
          relationshipType: "IPOD_SLED_PAIR",
        }),
      },
      device: {
        findUnique: async () => ({ assetTag: "GHT-SLD-130" }),
      },
    };
    const result = await checkExistingPairing(prisma as never, "device-1");
    expect(result.isPaired).toBe(true);
    expect(result.pairedDeviceTag).toBe("GHT-SLD-130");
  });
});
