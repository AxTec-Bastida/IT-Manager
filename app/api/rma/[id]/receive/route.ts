import { NextRequest, NextResponse } from "next/server";
import type { RmaItemResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { receiveRmaItems } from "@/lib/rma";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    await requirePermission("rma.write");
    const { id } = await context.params;
    const payload = await request.json();
    const items = Array.isArray(payload.items)
      ? payload.items
          .filter((item: Record<string, unknown>) => item?.selected)
          .map((item: Record<string, unknown>) => ({
            itemId: String(item.itemId),
            result: String(item.result || "REPAIRED") as RmaItemResult,
            returnCondition: stringOrNull(item.returnCondition),
            returnedAt: dateOrNull(item.returnedAt) ?? new Date(),
            replacementDeviceId: stringOrNull(item.replacementDeviceId),
            notes: stringOrNull(item.notes),
          }))
      : [];
    const rma = await receiveRmaItems(prisma, id, items);
    return NextResponse.json({ rma });
  } catch (error) {
    return handleApiError(error);
  }
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
