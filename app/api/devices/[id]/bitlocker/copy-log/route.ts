import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api";
import { getCurrentUser, makeActivityActor } from "@/lib/auth";
import { canRevealBitLockerKey } from "@/lib/bitlocker-vault";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  const { id } = await context.params;
  try {
    if (!user) return jsonError("Authentication required.", 401);
    if (!canRevealBitLockerKey(user)) return jsonError("Only Admin users can log BitLocker key copy actions.", 403);
    const device = await prisma.device.findUnique({ where: { id }, include: { bitLockerRecoveryKey: true } });
    if (!device) return jsonError("Asset not found.", 404);
    if (!device.bitLockerRecoveryKey) return jsonError("No BitLocker recovery key is stored for this asset.", 404);
    await prisma.activityLog.create({
      data: {
        ...makeActivityActor(user),
        action: "bitlocker.key_copied",
        entity: "device",
        entityId: device.id,
        message: `BitLocker recovery key copy was logged for ${device.assetTag || device.name}.`,
        metadata: JSON.stringify({ deviceId: device.id, keyId: device.bitLockerRecoveryKey.keyId, actionType: "copy" }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
