import { PrismaClient } from "@prisma/client";
import { buildMobilePairingCleanupPlan } from "../lib/mobile-legacy";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const backupConfirmed = process.argv.includes("--backup-confirmed");
  const devices = await prisma.device.findMany({
    where: {
      OR: [
        { assignedTo: { not: null } },
        { category: { in: ["PHONE", "TABLET"] } },
        { assetTag: { startsWith: "GHT-SLD-" } },
        { notes: { contains: "Source: Sled" } },
        { notes: { contains: "Source: iPod" } },
        { notes: { contains: "Source: iPhone" } },
        { notes: { contains: "Source: iPad" } },
      ],
    },
    include: {
      employee: { select: { fullName: true, employeeId: true } },
      aliases: { select: { aliasType: true, value: true } },
      sourceRelationships: { select: { relationshipType: true, status: true, targetDeviceId: true } },
      targetRelationships: { select: { relationshipType: true, status: true, sourceDeviceId: true } },
      assignmentItems: { select: { returnedAt: true } },
    },
    orderBy: [{ assetTag: "asc" }, { name: "asc" }],
  });
  const plan = buildMobilePairingCleanupPlan(devices);

  printPlan(plan);
  if (!apply) {
    console.log("\nDry run only. Re-run with --apply --backup-confirmed after reviewing the counts.");
    return;
  }
  if (!backupConfirmed) {
    throw new Error("Apply requires --backup-confirmed. Run npm run backup first and review the dry-run output.");
  }

  let aliasesCreated = 0;
  let pairingsCreated = 0;
  let assignmentsCleared = 0;

  for (const alias of plan.aliasesToCreate) {
    await prisma.deviceAlias.upsert({
      where: { deviceId_aliasType_value: { deviceId: alias.deviceId, aliasType: alias.aliasType, value: alias.value } },
      update: {
        sourceSheet: alias.sourceSheet ?? undefined,
        sourceColumn: alias.sourceColumn ?? undefined,
        sourceRow: alias.sourceRow ?? undefined,
        notes: alias.notes ?? undefined,
      },
      create: alias,
    });
    aliasesCreated += 1;
  }

  for (const pairing of plan.pairingsToCreate) {
    await prisma.deviceRelationship.upsert({
      where: {
        sourceDeviceId_targetDeviceId_relationshipType: {
          sourceDeviceId: pairing.sourceDeviceId,
          targetDeviceId: pairing.targetDeviceId,
          relationshipType: pairing.relationshipType,
        },
      },
      update: {
        status: pairing.status,
        sourceReference: pairing.sourceReference ?? undefined,
        confidence: pairing.confidence ?? undefined,
        notes: pairing.notes ?? undefined,
      },
      create: pairing,
    });
    pairingsCreated += 1;
  }

  for (const review of plan.assignmentsToClear) {
    await prisma.device.update({ where: { id: review.device.id }, data: { assignedTo: null } });
    await prisma.activityLog.create({
      data: {
        action: "mobile-legacy.cleanup",
        entity: "Device",
        entityId: review.device.id,
        message: "Corrected imported mobile/sled assignment value that was a legacy asset identifier, not a person.",
        metadata: JSON.stringify({
          previousAssignedTo: review.assignedValue,
          reason: review.reason,
          pairedDeviceId: review.possibleLinkedAsset?.id ?? null,
        }),
      },
    });
    assignmentsCleared += 1;
  }

  console.log("\nApplied cleanup:");
  console.log(`Aliases created/updated: ${aliasesCreated}`);
  console.log(`Pairings created/updated: ${pairingsCreated}`);
  console.log(`Fake assignments cleared: ${assignmentsCleared}`);
}

function printPlan(plan: ReturnType<typeof buildMobilePairingCleanupPlan>) {
  console.log("Mobile legacy cleanup plan");
  console.log(`Suspicious assigned values: ${plan.suspiciousAssignments.length}`);
  console.log(`Aliases to create/update: ${plan.aliasesToCreate.length}`);
  console.log(`Pairings to create/update: ${plan.pairingsToCreate.length}`);
  console.log(`Fake assignments safe to clear: ${plan.assignmentsToClear.length}`);
  console.log(`Ambiguous/unmatched pairing references: ${plan.ambiguousPairings.length}`);
  console.log("\nExamples:");
  for (const review of plan.suspiciousAssignments.slice(0, 20)) {
    console.log(
      JSON.stringify(
        {
          assetId: review.device.id,
          assetTag: review.device.assetTag,
          name: review.device.name,
          category: review.device.category,
          assignedTo: review.assignedValue,
          matchedAsset: review.possibleLinkedAsset?.assetTag ?? review.possibleLinkedAsset?.name ?? null,
          action: review.suggestedAction,
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
