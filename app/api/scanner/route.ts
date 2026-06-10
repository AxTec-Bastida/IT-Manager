import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanIpRange } from "@/lib/scanner";
import { handleApiError, jsonError } from "@/lib/api";
import { normalizeMacAddress } from "@/lib/ip";
import { makeActivityActor, requirePermission } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("inventory.write");
    const body = await request.json();
    const range = body.rangeId ? await prisma.ipRange.findUnique({ where: { id: String(body.rangeId) } }) : null;
    const settings = await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });

    const startIp = range?.startIp ?? String(body.startIp ?? "");
    const endIp = range?.endIp ?? String(body.endIp ?? "");
    const timeoutMs = Number(body.timeoutMs ?? settings.pingTimeoutMs);
    const maxScanSize = Number(body.maxScanSize ?? settings.maxScanSize);

    const scan = await scanIpRange(startIp, endIp, { timeoutMs, maxScanSize });
    if (!scan.ok) return jsonError(scan.message, 422);

    const run = await prisma.scanRun.create({
      data: {
        rangeId: range?.id,
        rangeName: range?.name ?? `${startIp} - ${endIp}`,
        startIp,
        endIp,
        status: "completed",
        completedAt: new Date(),
        results: settings.autoSaveScanResults
          ? {
              create: scan.results.map((result) => ({
                ipAddress: result.ipAddress,
                reachable: result.reachable,
                macAddress: normalizeMacAddress(result.macAddress),
                hostname: result.hostname,
                note: result.note,
                seenAt: result.seenAt,
              })),
            }
          : undefined,
      },
      include: { results: true },
    });

    const reachableIps = scan.results.filter((result) => result.reachable).map((result) => result.ipAddress);
    if (reachableIps.length > 0) {
      await prisma.device.updateMany({
        where: { ipAddress: { in: reachableIps } },
        data: { lastSeenAt: new Date() },
      });
    }

    const inventory = await prisma.device.findMany({ where: { ipAddress: { in: scan.results.map((result) => result.ipAddress) } } });
    const inventoryByIp = new Map(inventory.map((device) => [device.ipAddress, device]));
    const findings = scan.results
      .filter((result) => result.reachable)
      .map((result) => {
        const device = inventoryByIp.get(result.ipAddress);
        if (!device) return { ipAddress: result.ipAddress, severity: "MEDIUM", message: "Active on network but not in inventory." };
        if (device.status === "AVAILABLE") {
          return { ipAddress: result.ipAddress, severity: "HIGH", message: "Active on network but marked available in inventory." };
        }
        return { ipAddress: result.ipAddress, severity: "LOW", message: `Known device: ${device.name}.` };
      });

    await prisma.activityLog.create({
        data: {
          ...makeActivityActor(actor),
          action: "scan.completed",
        entity: "scan",
        entityId: run.id,
        message: `Scanned ${scan.results.length} IPs in ${run.rangeName}; ${reachableIps.length} responded.`,
      },
    });

    return NextResponse.json({ scanRun: run, results: scan.results, findings });
  } catch (error) {
    return handleApiError(error);
  }
}
