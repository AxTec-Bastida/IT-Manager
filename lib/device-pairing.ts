import type { Device, DeviceRelationshipType, Prisma } from "@prisma/client";
import { ClientInputError } from "@/lib/api";
import { isSledAsset } from "@/lib/asset-display";

export const chargerStatusValues = ["HEALTHY", "DAMAGED", "REPLACED", "MISSING"] as const;
export type ChargerStatusValue = (typeof chargerStatusValues)[number];

export const phoneSledRelationshipTypes = ["IPOD_SLED_PAIR", "IPHONE_SLED_PAIR"] as const satisfies readonly DeviceRelationshipType[];

type PairableDevice = Pick<Device, "id" | "name" | "assetTag" | "category" | "brand" | "model" | "serialNumber">;

export function isMobilePairAsset(device: PairableDevice) {
  const text = pairText(device);
  return device.category === "PHONE" || text.includes("ipod") || text.includes("iphone") || text.includes("ght-ipo") || text.includes("ght-iph");
}

export function getPhoneSledRelationshipType(device: PairableDevice): DeviceRelationshipType {
  const text = pairText(device);
  return text.includes("iphone") || text.includes("ght-iph") ? "IPHONE_SLED_PAIR" : "IPOD_SLED_PAIR";
}

export function resolvePhoneSledPair(source: PairableDevice, target: PairableDevice) {
  if (source.id === target.id) {
    throw new ClientInputError("An asset cannot be paired with itself.");
  }

  const sourceIsMobile = isMobilePairAsset(source);
  const targetIsMobile = isMobilePairAsset(target);
  const sourceIsSled = isSledAsset(source);
  const targetIsSled = isSledAsset(target);

  if (sourceIsMobile && targetIsSled && !targetIsMobile) {
    return { mobileDevice: source, sledDevice: target, relationshipType: getPhoneSledRelationshipType(source) };
  }

  if (sourceIsSled && targetIsMobile && !sourceIsMobile) {
    return { mobileDevice: target, sledDevice: source, relationshipType: getPhoneSledRelationshipType(target) };
  }

  throw new ClientInputError("Pairing must link one iPod/iPhone-style mobile asset with one sled asset.");
}

export async function replacePhoneSledPairing(
  tx: Prisma.TransactionClient,
  device: PairableDevice,
  pairedDeviceId: string | null | undefined,
  notes: string,
) {
  const relationshipTypes = [...phoneSledRelationshipTypes];

  await tx.deviceRelationship.deleteMany({
    where: {
      OR: [{ sourceDeviceId: device.id }, { targetDeviceId: device.id }],
      relationshipType: { in: relationshipTypes },
    },
  });

  if (!pairedDeviceId) return null;

  const pairedDevice = await tx.device.findUnique({
    where: { id: pairedDeviceId },
    select: {
      id: true,
      name: true,
      assetTag: true,
      category: true,
      brand: true,
      model: true,
      serialNumber: true,
    },
  });

  if (!pairedDevice) {
    throw new ClientInputError("Paired device was not found.", 404);
  }

  const { mobileDevice, sledDevice, relationshipType } = resolvePhoneSledPair(device, pairedDevice);

  await tx.deviceRelationship.deleteMany({
    where: {
      OR: [
        { sourceDeviceId: pairedDevice.id },
        { targetDeviceId: pairedDevice.id },
        { sourceDeviceId: device.id },
        { targetDeviceId: device.id },
      ],
      relationshipType: { in: relationshipTypes },
    },
  });

  return tx.deviceRelationship.create({
    data: {
      sourceDeviceId: mobileDevice.id,
      targetDeviceId: sledDevice.id,
      relationshipType,
      status: "ACTIVE",
      notes,
    },
  });
}

function pairText(device: PairableDevice) {
  return [device.name, device.assetTag, device.category, device.brand, device.model]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
