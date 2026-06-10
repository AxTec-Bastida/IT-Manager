import type { Alert, PrismaClient, RmaCase, RmaCaseStatus, RmaItem, RmaItemResult } from "@prisma/client";
import { ClientInputError } from "@/lib/api";

export const activeRmaStatuses: RmaCaseStatus[] = ["SENT", "ACTIVE", "PARTIALLY_RETURNED"];

export type RmaDeviceSelection = {
  deviceId: string;
  issueDescription?: string | null;
  conditionSent?: string | null;
  accessoriesSent?: string | null;
  notes?: string | null;
};

export type CreateRmaInput = {
  rmaNumber: string;
  title?: string | null;
  destination: string;
  vendorName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  sentAt?: Date | null;
  reminderAfterDays?: number;
  status?: RmaCaseStatus;
  notes?: string | null;
  devices: RmaDeviceSelection[];
};

export type ReceiveRmaItemInput = {
  itemId: string;
  result: RmaItemResult;
  returnCondition?: string | null;
  returnedAt?: Date | null;
  replacementDeviceId?: string | null;
  notes?: string | null;
};

export function expectedFollowUpDate(sentAt: Date | null | undefined, reminderAfterDays = 7) {
  if (!sentAt) return null;
  const date = new Date(sentAt);
  date.setDate(date.getDate() + Math.max(1, reminderAfterDays));
  return date;
}

export function daysActive(sentAt: Date | null | undefined, now = new Date()) {
  if (!sentAt) return 0;
  return Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(sentAt).getTime()) / 86_400_000));
}

export function deviceUpdateForRmaResult(result: RmaItemResult, returnCondition?: string | null) {
  const conditionText = String(returnCondition ?? "").toUpperCase();
  if (result === "LOST") return { status: "LOST" as const, condition: "NEEDS_REVIEW" as const };
  if (result === "RETIRED" || result === "REPLACED") return { status: "RETIRED" as const, condition: "NEEDS_REVIEW" as const };
  if (result === "REJECTED") {
    return {
      status: "IN_REPAIR_RMA" as const,
      condition: conditionText.includes("NOT") ? "NOT_WORKING" as const : conditionText.includes("DAMAGE") ? "DAMAGED" as const : "NEEDS_REVIEW" as const,
    };
  }
  if (["REPAIRED", "RETURNED_AS_IS"].includes(result)) {
    return {
      status: "AVAILABLE" as const,
      condition: conditionText.includes("FAIR") ? "FAIR" as const : "GOOD" as const,
    };
  }
  return { status: "IN_REPAIR_RMA" as const, condition: "NEEDS_REVIEW" as const };
}

export function statusFromRmaItems(items: Array<Pick<RmaItem, "result" | "returnedAt">>, currentStatus?: RmaCaseStatus): RmaCaseStatus {
  if (currentStatus === "CANCELLED" || currentStatus === "CLOSED") return currentStatus;
  if (!items.length) return "DRAFT";
  const returned = items.filter((item) => item.result !== "PENDING" || item.returnedAt).length;
  if (returned === 0) return currentStatus === "SENT" ? "SENT" : "ACTIVE";
  if (returned === items.length) return "RETURNED";
  return "PARTIALLY_RETURNED";
}

export function isRmaFollowUpDue(rma: Pick<RmaCase, "status" | "sentAt" | "expectedFollowUpAt" | "reminderAfterDays">, now = new Date()) {
  if (!activeRmaStatuses.includes(rma.status)) return false;
  const due = rma.expectedFollowUpAt ?? expectedFollowUpDate(rma.sentAt, rma.reminderAfterDays);
  return Boolean(due && startOfDay(due).getTime() <= startOfDay(now).getTime());
}

export function rmaAlertType(rma: Pick<RmaCase, "status" | "sentAt" | "expectedFollowUpAt" | "reminderAfterDays">, now = new Date()) {
  if (!isRmaFollowUpDue(rma, now)) return null;
  const activeDays = daysActive(rma.sentAt, now);
  if (rma.expectedFollowUpAt && startOfDay(rma.expectedFollowUpAt).getTime() < startOfDay(now).getTime()) return "RMA_OVERDUE" as const;
  if (activeDays > rma.reminderAfterDays) return "RMA_ACTIVE_REMINDER" as const;
  return "RMA_FOLLOW_UP_DUE" as const;
}

export function buildRmaAlertCandidate(rma: RmaCase & { items: RmaItem[] }, now = new Date()) {
  const type = rmaAlertType(rma, now);
  if (!type) return null;
  const pending = rma.items.filter((item) => item.result === "PENDING").length;
  return {
    type,
    source: "SYSTEM" as const,
    severity: type === "RMA_OVERDUE" ? "HIGH" as const : "MEDIUM" as const,
    title: `RMA ${rma.rmaNumber} follow-up due`,
    message: `RMA ${rma.rmaNumber} has been active for ${daysActive(rma.sentAt, now)} days with ${pending} pending device${pending === 1 ? "" : "s"}.`,
    metadata: JSON.stringify({ rmaCaseId: rma.id, rmaNumber: rma.rmaNumber, type }),
  };
}

export async function createRmaCase(prisma: PrismaClient, input: CreateRmaInput) {
  if (!input.rmaNumber.trim()) throw new ClientInputError("RMA number is required.");
  if (!input.destination.trim()) throw new ClientInputError("Destination is required.");
  if (!input.devices.length) throw new ClientInputError("Select at least one device for this RMA.");
  const sentAt = input.sentAt ?? null;
  const status = input.status ?? (sentAt ? "SENT" : "DRAFT");
  const reminderAfterDays = Math.max(1, Number(input.reminderAfterDays ?? 7));
  const deviceIds = [...new Set(input.devices.map((item) => item.deviceId).filter(Boolean))];

  return prisma.$transaction(async (tx) => {
    const existingActiveItems = deviceIds.length
      ? await tx.rmaItem.findMany({
          where: { deviceId: { in: deviceIds }, result: "PENDING", rmaCase: { status: { in: activeRmaStatuses } } },
          include: { rmaCase: true, device: true },
        })
      : [];
    if (existingActiveItems.length) {
      throw new ClientInputError(`${existingActiveItems[0].device.name} is already in active RMA ${existingActiveItems[0].rmaCase.rmaNumber}.`);
    }

    const rma = await tx.rmaCase.create({
      data: {
        rmaNumber: input.rmaNumber.trim(),
        title: clean(input.title),
        destination: input.destination.trim(),
        vendorName: clean(input.vendorName),
        contactName: clean(input.contactName),
        contactEmail: clean(input.contactEmail),
        carrier: clean(input.carrier),
        trackingNumber: clean(input.trackingNumber),
        sentAt,
        expectedFollowUpAt: expectedFollowUpDate(sentAt, reminderAfterDays),
        reminderAfterDays,
        status,
        notes: clean(input.notes),
        items: {
          create: input.devices.map((item) => ({
            deviceId: item.deviceId,
            issueDescription: clean(item.issueDescription),
            conditionSent: clean(item.conditionSent),
            accessoriesSent: clean(item.accessoriesSent),
            sentAt,
            notes: clean(item.notes),
          })),
        },
      },
      include: { items: { include: { device: true } } },
    });

    if (activeRmaStatuses.includes(status)) {
      for (const item of rma.items) {
        await tx.device.update({ where: { id: item.deviceId }, data: { status: "IN_REPAIR_RMA" } });
        await tx.activityLog.create({
          data: {
            action: "rma.item.sent",
            entity: "device",
            entityId: item.deviceId,
            message: `${item.device.name} was sent to RMA ${rma.rmaNumber}. Assignment history was preserved.`,
            metadata: JSON.stringify({ rmaCaseId: rma.id, rmaNumber: rma.rmaNumber, assignedTo: item.device.assignedTo, employeeId: item.device.employeeId }),
          },
        });
      }
    }

    await tx.activityLog.create({
      data: {
        action: "rma.created",
        entity: "RmaCase",
        entityId: rma.id,
        message: `RMA ${rma.rmaNumber} created with ${rma.items.length} device${rma.items.length === 1 ? "" : "s"}.`,
      },
    });

    return rma;
  });
}

export async function receiveRmaItems(prisma: PrismaClient, rmaCaseId: string, items: ReceiveRmaItemInput[]) {
  return prisma.$transaction(async (tx) => {
    const rma = await tx.rmaCase.findUnique({ where: { id: rmaCaseId }, include: { items: { include: { device: true } } } });
    if (!rma) throw new ClientInputError("RMA case not found.", 404);
    const itemMap = new Map(rma.items.map((item) => [item.id, item]));
    const returnedAtDefault = new Date();

    for (const input of items) {
      const item = itemMap.get(input.itemId);
      if (!item) continue;
      const returnedAt = input.returnedAt ?? returnedAtDefault;
      await tx.rmaItem.update({
        where: { id: item.id },
        data: {
          result: input.result,
          returnCondition: clean(input.returnCondition),
          returnedAt,
          replacementDeviceId: clean(input.replacementDeviceId),
          notes: clean(input.notes),
        },
      });
      await tx.device.update({ where: { id: item.deviceId }, data: deviceUpdateForRmaResult(input.result, input.returnCondition) });
      await tx.activityLog.create({
        data: {
          action: "rma.item.received",
          entity: "device",
          entityId: item.deviceId,
          message: `${item.device.name} was received from RMA ${rma.rmaNumber} as ${input.result.replaceAll("_", " ")}.`,
          metadata: JSON.stringify({ rmaCaseId: rma.id, rmaNumber: rma.rmaNumber, result: input.result }),
        },
      });
    }

    const updated = await tx.rmaCase.findUnique({ where: { id: rmaCaseId }, include: { items: true } });
    if (!updated) throw new Error("RMA case not found after receive.");
    const nextStatus = statusFromRmaItems(updated.items, updated.status);
    const saved = await tx.rmaCase.update({ where: { id: rmaCaseId }, data: { status: nextStatus }, include: { items: { include: { device: true, replacementDevice: true } } } });
    await tx.activityLog.create({
      data: {
        action: "rma.received",
        entity: "RmaCase",
        entityId: rmaCaseId,
        message: `RMA ${saved.rmaNumber} receive update saved. Status is now ${nextStatus.replaceAll("_", " ")}.`,
      },
    });
    return saved;
  });
}

export async function refreshRmaReminders(prisma: PrismaClient, now = new Date()) {
  const rmas = await prisma.rmaCase.findMany({ where: { status: { in: activeRmaStatuses } }, include: { items: true } });
  const existing = await prisma.alert.findMany({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] }, type: { in: ["RMA_FOLLOW_UP_DUE", "RMA_ACTIVE_REMINDER", "RMA_OVERDUE"] } } });
  let created = 0;
  let updated = 0;
  const existingByKey = new Map(existing.map((alert) => [rmaAlertKey(alert), alert]));

  for (const rma of rmas) {
    const candidate = buildRmaAlertCandidate(rma, now);
    if (!candidate) continue;
    const key = `${rma.id}:${candidate.type}`;
    const matched = existingByKey.get(key);
    if (matched) {
      await prisma.alert.update({
        where: { id: matched.id },
        data: { title: candidate.title, message: candidate.message, metadata: candidate.metadata, lastSeenAt: now },
      });
      updated += 1;
    } else {
      await prisma.alert.create({ data: candidate });
      created += 1;
    }
  }
  return { alertsCreated: created, alertsUpdated: updated };
}

function rmaAlertKey(alert: Pick<Alert, "metadata" | "type">) {
  try {
    const metadata = JSON.parse(alert.metadata || "{}");
    return `${metadata.rmaCaseId}:${alert.type}`;
  } catch {
    return `unknown:${alert.type}`;
  }
}

function clean(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
