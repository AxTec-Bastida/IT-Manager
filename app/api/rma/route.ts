import { NextRequest, NextResponse } from "next/server";
import type { Prisma, RmaCaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { activeRmaStatuses, createRmaCase } from "@/lib/rma";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();
  const followUpDue = searchParams.get("followUpDue") === "true";
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const where: Prisma.RmaCaseWhereInput = {
    ...(status === "active" ? { status: { in: activeRmaStatuses } } : status ? { status: status as RmaCaseStatus } : {}),
    ...(followUpDue ? { status: { in: activeRmaStatuses }, expectedFollowUpAt: { lte: today } } : {}),
    ...(q
      ? {
          OR: [
            { rmaNumber: { contains: q } },
            { title: { contains: q } },
            { destination: { contains: q } },
            { vendorName: { contains: q } },
            { trackingNumber: { contains: q } },
            { items: { some: { device: { OR: [{ assetTag: { contains: q } }, { serialNumber: { contains: q } }, { model: { contains: q } }, { name: { contains: q } }] } } } },
          ],
        }
      : {}),
  };

  const cases = await prisma.rmaCase.findMany({
    where,
    include: { items: { include: { device: true } } },
    orderBy: [{ status: "asc" }, { expectedFollowUpAt: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ cases });
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("rma.write");
    const payload = await request.json();
    const rma = await createRmaCase(prisma, parseRmaPayload(payload));
    return NextResponse.json({ rma }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export function parseRmaPayload(payload: Record<string, unknown>) {
  const deviceIds = Array.isArray(payload.deviceIds) ? payload.deviceIds.map(String).filter(Boolean) : [];
  return {
    rmaNumber: String(payload.rmaNumber ?? "").trim(),
    title: stringOrNull(payload.title),
    destination: String(payload.destination ?? "").trim(),
    vendorName: stringOrNull(payload.vendorName),
    contactName: stringOrNull(payload.contactName),
    contactEmail: stringOrNull(payload.contactEmail),
    carrier: stringOrNull(payload.carrier),
    trackingNumber: stringOrNull(payload.trackingNumber),
    sentAt: dateOrNull(payload.sentAt),
    reminderAfterDays: Number(payload.reminderAfterDays ?? 7),
    status: (String(payload.status ?? "") || undefined) as RmaCaseStatus | undefined,
    notes: stringOrNull(payload.notes),
    devices: deviceIds.map((deviceId) => ({
      deviceId,
      issueDescription: stringOrNull(payload.issueDescription),
      conditionSent: stringOrNull(payload.conditionSent),
      accessoriesSent: stringOrNull(payload.accessoriesSent),
    })),
  };
}

function stringOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function dateOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}
