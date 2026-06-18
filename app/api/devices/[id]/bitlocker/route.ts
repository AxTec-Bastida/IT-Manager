import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ClientInputError, handleApiError, jsonError } from "@/lib/api";
import { getCurrentUser, makeActivityActor } from "@/lib/auth";
import { canManageBitLockerKey, canRevealBitLockerKey, canViewBitLockerSummary, encryptRecoveryKey, isBitLockerEligibleCategory, normalizeRecoveryKey, requireVaultSecret, sanitizeBitLockerRecord, validateRecoveryKeyFormat, validateVaultSecret } from "@/lib/bitlocker-vault";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const inputSchema = z.object({
  recoveryKey: z.string().trim().optional().nullable(),
  keyId: z.string().trim().max(120).optional().nullable().transform((value) => value || null),
  volumeLabel: z.string().trim().max(120).optional().nullable().transform((value) => value || null),
  protectorId: z.string().trim().max(160).optional().nullable().transform((value) => value || null),
  source: z.enum(["MANUAL", "IMPORT", "OTHER"]).default("MANUAL"),
  notes: z.string().trim().max(1000).optional().nullable().transform((value) => value || null),
});

export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    if (!canViewBitLockerSummary(user)) return jsonError("You do not have permission to perform this action.", 403);
    const { id } = await context.params;
    const device = await prisma.device.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        assetTag: true,
        category: true,
        bitLockerRecoveryKey: true,
      },
    });
    if (!device) return jsonError("Asset not found.", 404);
    const includeMetadata = ["ADMIN", "IT_STAFF", "AUDITOR"].includes(user.role);
    return NextResponse.json({
      eligible: isBitLockerEligibleCategory(device.category),
      device: { id: device.id, name: device.name, assetTag: device.assetTag, category: device.category },
      vaultSecret: { configured: validateVaultSecret().configured, usable: validateVaultSecret().usable },
      canManage: canManageBitLockerKey(user),
      canReveal: canRevealBitLockerKey(user),
      record: sanitizeBitLockerRecord(device.bitLockerRecoveryKey, { includeRestrictedMetadata: includeMetadata }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  let deviceId = "unknown";
  try {
    if (!user) return jsonError("Authentication required.", 401);
    if (!canManageBitLockerKey(user)) return jsonError("You do not have permission to update BitLocker vault records.", 403);
    const { id } = await context.params;
    deviceId = id;
    requireVaultSecret();
    const input = inputSchema.parse(await request.json());
    const device = await prisma.device.findUnique({ where: { id: deviceId }, include: { bitLockerRecoveryKey: true } });
    if (!device) return jsonError("Asset not found.", 404);
    if (!isBitLockerEligibleCategory(device.category)) throw new ClientInputError("BitLocker vault records are only available for laptop and desktop assets.", 422);

    const recoveryKey = input.recoveryKey ? normalizeRecoveryKey(input.recoveryKey) : null;
    if (!device.bitLockerRecoveryKey && !recoveryKey) throw new ClientInputError("Recovery key is required when creating a BitLocker vault record.", 422);
    if (recoveryKey && !validateRecoveryKeyFormat(recoveryKey)) throw new ClientInputError("Enter a valid BitLocker recovery key: 8 groups of 6 digits.", 422);

    const record = await prisma.$transaction(async (tx) => {
      const data = {
        keyId: input.keyId,
        volumeLabel: input.volumeLabel,
        protectorId: input.protectorId,
        source: input.source,
        notes: input.notes,
        updatedByUserId: user.id,
        updatedByName: user.name,
        ...(recoveryKey ? { recoveryKeyEncrypted: encryptRecoveryKey(recoveryKey) } : {}),
      };
      const saved = device.bitLockerRecoveryKey
        ? await tx.bitLockerRecoveryKey.update({ where: { deviceId: device.id }, data })
        : await tx.bitLockerRecoveryKey.create({
            data: {
              deviceId: device.id,
              recoveryKeyEncrypted: encryptRecoveryKey(recoveryKey!),
              keyId: input.keyId,
              volumeLabel: input.volumeLabel,
              protectorId: input.protectorId,
              source: input.source,
              notes: input.notes,
              createdByUserId: user.id,
              createdByName: user.name,
              updatedByUserId: user.id,
              updatedByName: user.name,
            },
          });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(user),
          action: device.bitLockerRecoveryKey ? "bitlocker.key_updated" : "bitlocker.key_created",
          entity: "device",
          entityId: device.id,
          message: `BitLocker vault record ${device.bitLockerRecoveryKey ? "updated" : "created"} for ${device.assetTag || device.name}.`,
          metadata: JSON.stringify({ deviceId: device.id, keyId: saved.keyId, source: saved.source, recoveryKeyReplaced: Boolean(recoveryKey) }),
        },
      });
      return saved;
    });

    return NextResponse.json({ record: sanitizeBitLockerRecord(record, { includeRestrictedMetadata: true }) });
  } catch (error) {
    if (user && error instanceof ClientInputError && /vault secret/i.test(error.message)) {
      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(user),
          action: "bitlocker.secret_missing",
          entity: "device",
          entityId: deviceId,
          message: "BitLocker vault update was blocked because BITLOCKER_VAULT_SECRET is not configured.",
          metadata: JSON.stringify({ deviceId, reason: "secret_missing" }),
        },
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}
