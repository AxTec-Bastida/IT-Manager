import { NextRequest, NextResponse } from "next/server";
import { AlertStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, jsonError } from "@/lib/api";
import { alertCanTransition } from "@/lib/alert-workflows";
import { requirePermission } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await requirePermission("inventory.write");
    const { id } = await context.params;
    const body = await request.json();
    const status = String(body.status ?? "") as AlertStatus;
    if (!Object.values(AlertStatus).includes(status)) return jsonError("Invalid alert status.", 400);
    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) return jsonError("Alert not found.", 404);
    if (!alertCanTransition(alert.status, status)) return jsonError(`Cannot move alert from ${alert.status} to ${status}.`, 400);
    const now = new Date();
    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status,
        resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote.trim() || null : alert.resolutionNote,
        ...(status === "ACKNOWLEDGED" ? { acknowledgedAt: now } : {}),
        ...(status === "IGNORED" ? { ignoredAt: now } : {}),
        ...(status === "RESOLVED" ? { resolvedAt: now } : {}),
      },
    });
    await prisma.activityLog.create({
      data: {
        action: status === "ACKNOWLEDGED" ? "alert.acknowledged" : status === "RESOLVED" ? "alert.resolved" : status === "IGNORED" ? "alert.ignored" : "alert.updated",
        entity: "alert",
        entityId: id,
        message: `${alert.title} status changed to ${status}.`,
        metadata: JSON.stringify({ resolutionNote: updated.resolutionNote }),
      },
    });
    return NextResponse.json({ alert: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
