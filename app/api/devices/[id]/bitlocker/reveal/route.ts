import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { getCurrentUser, makeActivityActor } from "@/lib/auth";
import { canRevealBitLockerKey, decryptRecoveryKey, redactRecoveryKey, requireVaultSecret } from "@/lib/bitlocker-vault";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  const { id } = await context.params;
  try {
    if (!user) return jsonError("Authentication required.", 401);
    const device = await prisma.device.findUnique({ where: { id }, include: { bitLockerRecoveryKey: true } });
    if (!device) return jsonError("Asset not found.", 404);
    if (!device.bitLockerRecoveryKey) return jsonError("No BitLocker recovery key is stored for this asset.", 404);
    if (!canRevealBitLockerKey(user)) {
      await prisma.activityLog.create({
        data: {
          ...makeActivityActor(user),
          action: "bitlocker.reveal_denied",
          entity: "device",
          entityId: device.id,
          message: `BitLocker recovery key reveal was denied for ${device.assetTag || device.name}.`,
          metadata: JSON.stringify({ deviceId: device.id, keyId: device.bitLockerRecoveryKey.keyId, reason: "forbidden" }),
        },
      });
      return jsonError("Only Admin users can reveal BitLocker recovery keys.", 403);
    }
    requireVaultSecret();
    const recoveryKey = decryptRecoveryKey(device.bitLockerRecoveryKey.recoveryKeyEncrypted);
    await prisma.$transaction(async (tx) => {
      await tx.bitLockerRecoveryKey.update({
        where: { deviceId: device.id },
        data: { lastViewedAt: new Date(), lastViewedByUserId: user.id, lastViewedByName: user.name },
      });
      await tx.activityLog.create({
        data: {
          ...makeActivityActor(user),
          action: "bitlocker.key_revealed",
          entity: "device",
          entityId: device.id,
          message: `BitLocker recovery key was revealed for ${device.assetTag || device.name}.`,
          metadata: JSON.stringify({ deviceId: device.id, keyId: device.bitLockerRecoveryKey?.keyId, actionType: "reveal" }),
        },
      });
    });

    return NextResponse.json(
      { recoveryKey, redacted: redactRecoveryKey(recoveryKey), expiresInSeconds: 60 },
      { headers: { "cache-control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
