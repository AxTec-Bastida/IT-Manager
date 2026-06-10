import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";
import { canPerformAction, requirePermission } from "@/lib/auth";
import { parseScannedLabel } from "@/lib/scan-label";
import { isPhysicalLabelAliasType, normalizedAliasCompare } from "@/lib/label-aliases";
import { preferredWorkflowForLookup, sortSerializedAssetMatches, sortStockWorkflowMatches } from "@/lib/item-workflow-classification";

export async function POST(request: NextRequest) {
  try {
  const actor = await requirePermission("inventory.read");
  const canUseStockWorkflow = canPerformAction(actor, "stock.write");
  const canUseEmployeeWorkflow = canPerformAction(actor, "assignments.write") || canPerformAction(actor, "loans.write") || canUseStockWorkflow;
  const body = await request.json();
  const parsed = parseScannedLabel(String(body.value ?? ""));
  const terms = [...new Set([parsed.raw, parsed.query, parsed.ipAddress, parsed.macAddress, parsed.serialNumber, parsed.deviceName, parsed.assetTag].filter(Boolean) as string[])];
  const normalizedTerms = new Set(terms.map((term) => normalizedAliasCompare(term)));

  const deviceInclude: Prisma.DeviceInclude = {
    ipRange: true,
    employee: true,
    expectedLocationZone: true,
    alerts: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, orderBy: { lastSeenAt: "desc" }, take: 5 },
    assignmentItems: {
      where: { returnedAt: null, assignment: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } },
      include: { assignment: { include: { employee: true } } },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
    rmaItems: { where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } }, include: { rmaCase: true }, orderBy: { createdAt: "desc" }, take: 1 },
    assetLoanItems: { where: { returnStatus: "PENDING", loan: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } }, include: { loan: { include: { employee: true, temporaryBorrower: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
    locationHistory: { orderBy: { seenAt: "desc" }, take: 1, include: { apMapLocation: { include: { locationZone: true } } } },
    unifiSnapshots: { orderBy: { syncedAt: "desc" }, take: 1 },
    aliases: { orderBy: { createdAt: "asc" } },
  };

  let devices = terms.length
    ? await (async () => {
        const [exactDevices, looseDevices] = await Promise.all([
          prisma.device.findMany({
            where: {
              OR: terms.flatMap((term) => [
                { assetTag: term },
                { ipAddress: term },
                { macAddress: term },
                { serialNumber: term },
                { name: term },
                { aliases: { some: { value: term } } },
              ]),
            },
            include: deviceInclude,
            orderBy: { updatedAt: "desc" },
            take: 20,
          }),
          prisma.device.findMany({
            where: {
              OR: terms.flatMap((term) => [
                { assetTag: term },
                { assetTag: { contains: term } },
                { ipAddress: term },
                { macAddress: term },
                { serialNumber: term },
                { serialNumber: { contains: term } },
                { name: term },
                { model: { contains: term } },
                { notes: { contains: term } },
                { assignedTo: { contains: term } },
                { aliases: { some: { value: term } } },
                { aliases: { some: { value: { contains: term } } } },
              ]),
            },
            include: deviceInclude,
            orderBy: { updatedAt: "desc" },
            take: 30,
          }),
        ]);
        return [...new Map([...exactDevices, ...looseDevices].map((device) => [device.id, device])).values()];
      })()
    : [];

  const matchedAliases = terms.length
    ? devices.flatMap((device) =>
        (device.aliases ?? [])
          .filter((alias) => normalizedTerms.has(normalizedAliasCompare(alias.value)))
          .map((alias) => ({
            deviceId: device.id,
            aliasType: alias.aliasType,
            value: alias.value,
            label: isPhysicalLabelAliasType(alias.aliasType) ? "physical label / scan code" : "device alias",
            officialAssetTag: device.assetTag,
          })),
      )
    : [];
  const aliasGroups = new Map<string, typeof matchedAliases>();
  for (const alias of matchedAliases) {
    const key = normalizedAliasCompare(alias.value);
    aliasGroups.set(key, [...(aliasGroups.get(key) ?? []), alias]);
  }
  const aliasConflicts = [...aliasGroups.entries()]
    .map(([value, aliases]) => ({ value, aliases: [...new Map(aliases.map((alias) => [alias.deviceId, alias])).values()] }))
    .filter((group) => group.aliases.length > 1);

  let stockItems = canUseStockWorkflow && terms.length
    ? await prisma.stockItem.findMany({
        where: {
          active: true,
          OR: terms.flatMap((term) => [
            { barcodeValue: term },
            { barcodeValue: { contains: term } },
            { sku: term },
            { sku: { contains: term } },
            { name: term },
            { name: { contains: term } },
            { compatibleModels: { contains: term } },
            { notes: { contains: term } },
          ]),
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : [];

  stockItems = sortStockWorkflowMatches(stockItems, parsed.query);
  devices = sortSerializedAssetMatches(devices, parsed.query);

  let archivedStockItems = canUseStockWorkflow && terms.length
    ? await prisma.stockItem.findMany({
        where: {
          active: false,
          OR: terms.flatMap((term) => [
            { barcodeValue: term },
            { barcodeValue: { contains: term } },
            { sku: term },
            { sku: { contains: term } },
            { name: term },
            { name: { contains: term } },
            { compatibleModels: { contains: term } },
            { notes: { contains: term } },
          ]),
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      })
    : [];
  archivedStockItems = sortStockWorkflowMatches(archivedStockItems, parsed.query);

  const employees = canUseEmployeeWorkflow && terms.length
    ? await prisma.employee.findMany({
        where: {
          status: "ACTIVE",
          OR: terms.flatMap((term) => [{ employeeId: term }, { employeeId: { contains: term } }, { fullName: { contains: term } }, { email: { contains: term } }]),
        },
        include: {
          assignedDevices: { select: { id: true, name: true, assetTag: true }, orderBy: { updatedAt: "desc" }, take: 10 },
          stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, include: { stockItem: true }, orderBy: { issuedAt: "desc" }, take: 5 },
          assetLoans: { where: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } }, include: { items: true }, orderBy: { expectedReturnAt: "asc" }, take: 5 },
        },
        orderBy: { fullName: "asc" },
        take: 10,
      })
    : [];

  const temporaryBorrowers = canUseStockWorkflow && terms.length
    ? await prisma.temporaryBorrower.findMany({
        where: {
          active: true,
          OR: terms.flatMap((term) => [{ tempId: term }, { tempId: { contains: term } }, { name: { contains: term } }, { email: { contains: term } }]),
        },
        include: {
          stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, include: { stockItem: true }, orderBy: { issuedAt: "desc" }, take: 5 },
          assetLoans: { where: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } }, include: { items: true }, orderBy: { expectedReturnAt: "asc" }, take: 5 },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    : [];

  const workflowRecommendation = preferredWorkflowForLookup({ query: parsed.query, devices, stockItems });

  return NextResponse.json({ parsed, devices, stockItems, archivedStockItems, employees, temporaryBorrowers, matchedAliases, aliasConflicts, workflowRecommendation });
  } catch (error) {
    return handleApiError(error);
  }
}
