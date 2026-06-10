import { NextRequest, NextResponse } from "next/server";
import type { RmaCaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { activeRmaStatuses, expectedFollowUpDate } from "@/lib/rma";
import { parseRmaPayload } from "@/app/api/rma/route";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const rma = await prisma.rmaCase.findUnique({ where: { id }, include: { items: { include: { device: true, replacementDevice: true } } } });
  if (!rma) return jsonError("RMA case not found.", 404);
  return NextResponse.json({ rma });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = parseRmaPayload(payload);
    const existing = await prisma.rmaCase.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return jsonError("RMA case not found.", 404);

    const status = (String(payload.status ?? existing.status) || existing.status) as RmaCaseStatus;
    const reminderAfterDays = Math.max(1, Number(parsed.reminderAfterDays || existing.reminderAfterDays));
    const sentAt = parsed.sentAt ?? existing.sentAt;
    const newDeviceIds = parsed.devices.map((item) => item.deviceId).filter((deviceId) => !existing.items.some((item) => item.deviceId === deviceId));

    const rma = await prisma.$transaction(async (tx) => {
      const updated = await tx.rmaCase.update({
        where: { id },
        data: {
          rmaNumber: parsed.rmaNumber || existing.rmaNumber,
          title: parsed.title,
          destination: parsed.destination || existing.destination,
          vendorName: parsed.vendorName,
          contactName: parsed.contactName,
          contactEmail: parsed.contactEmail,
          carrier: parsed.carrier,
          trackingNumber: parsed.trackingNumber,
          sentAt,
          reminderAfterDays,
          expectedFollowUpAt: expectedFollowUpDate(sentAt, reminderAfterDays),
          status,
          notes: parsed.notes,
          items: newDeviceIds.length ? { create: newDeviceIds.map((deviceId) => ({ deviceId, sentAt: activeRmaStatuses.includes(status) ? sentAt : null })) } : undefined,
        },
        include: { items: { include: { device: true, replacementDevice: true } } },
      });

      if (activeRmaStatuses.includes(status)) {
        const affected = updated.items.filter((item) => item.result === "PENDING");
        for (const item of affected) {
          await tx.device.update({ where: { id: item.deviceId }, data: { status: "IN_REPAIR_RMA" } });
        }
      }

      await tx.activityLog.create({
        data: { action: "rma.updated", entity: "RmaCase", entityId: id, message: `RMA ${updated.rmaNumber} was updated.` },
      });
      return updated;
    });

    return NextResponse.json({ rma });
  } catch (error) {
    return handleApiError(error);
  }
}
