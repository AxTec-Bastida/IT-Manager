import { collectReadinessChecks, formatDoctorChecks } from "@/lib/readiness";
import { prisma } from "@/lib/prisma";
import { inspectMigrationMetadata } from "@/lib/prisma-baseline";

async function main() {
  const userCount = await prisma.appUser.count().catch(() => null);
  const migrationMetadata = await inspectMigrationMetadata(prisma)
    .then((metadata) => ({ migrationTableExists: metadata.migrationTableExists, appliedMigrationCount: metadata.appliedMigrationNames.length }))
    .catch((error) => ({ migrationTableExists: false, appliedMigrationCount: 0, error: error instanceof Error ? error.message : "Unknown error" }));
  const result = await collectReadinessChecks({ userCount, migrationMetadata });
  console.log("Warehouse IT Inventory readiness check");
  console.log(`Overall: ${result.status}`);
  console.log(`Project: ${result.projectRoot}`);
  console.log("");
  console.log(formatDoctorChecks(result.checks));
  if (result.status === "FAIL") {
    console.log("");
    console.log("One or more required checks failed. Fix FAIL items before daily production-like use.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
