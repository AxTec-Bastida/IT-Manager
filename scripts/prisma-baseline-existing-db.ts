import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  inspectMigrationMetadata,
  loadMigrationRequirements,
  resolveMigrationApplied,
  runPrismaMigrateStatus,
  verifyMigrationRequirements,
} from "@/lib/prisma-baseline";

const prisma = new PrismaClient();

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const dryRun = args.has("--dry-run") || !apply;
  const confirmed = args.has("--confirm") && process.env.CONFIRM_DB_BASELINE === "true";
  const projectRoot = process.cwd();
  const migrationsDir = path.join(projectRoot, "prisma", "migrations");

  console.log("Prisma baseline existing DB helper");
  console.log(`Project: ${projectRoot}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log("");
  console.log("Safety:");
  console.log("- This script never deletes data.");
  console.log("- This script never runs destructive schema reset commands.");
  console.log("- Apply mode only marks existing migrations as applied in Prisma migration metadata.");
  console.log("- Run npm run backup and keep an emergency prisma/dev.db copy before apply.");
  console.log("");

  const status = await runPrismaMigrateStatus(projectRoot);
  console.log("Current prisma migrate status:");
  console.log((status.stdout || status.stderr).trim() || "(no output)");
  console.log("");

  const requirements = await loadMigrationRequirements(migrationsDir);
  const verification = await verifyMigrationRequirements(prisma, requirements);
  const metadata = await inspectMigrationMetadata(prisma);
  const applied = new Set(metadata.appliedMigrationNames);
  const failures = verification.filter((result) => !result.ok);
  const pendingMetadata = verification.filter((result) => !applied.has(result.migrationName));

  console.log(`Migration metadata table exists: ${metadata.migrationTableExists ? "yes" : "no"}`);
  console.log(`Applied migrations recorded: ${metadata.appliedMigrationNames.length}`);
  console.log(`Migration folders found: ${requirements.length}`);
  console.log(`Migrations not recorded as applied: ${pendingMetadata.length}`);
  console.log("");

  console.log("Schema footprint verification:");
  for (const result of verification) {
    const summary = result.ok ? "ok" : `missing ${result.missingTables.length} table(s), ${Object.values(result.missingColumns).flat().length} column(s)`;
    console.log(`- ${result.migrationName}: ${summary}`);
    for (const table of result.missingTables) console.log(`  missing table: ${table}`);
    for (const [table, columns] of Object.entries(result.missingColumns)) console.log(`  missing columns on ${table}: ${columns.join(", ")}`);
  }
  console.log("");

  if (failures.length) {
    console.error("Baseline refused: one or more migration footprints are missing from the current database.");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("Dry run only. No migration metadata was changed.");
    console.log("To apply after reviewing this output:");
    console.log("  $env:CONFIRM_DB_BASELINE='true'; npm run db:baseline:apply -- --confirm");
    return;
  }

  if (!confirmed) {
    console.error("Apply refused. Set CONFIRM_DB_BASELINE=true and pass --confirm after creating a backup.");
    process.exitCode = 1;
    return;
  }

  if (!pendingMetadata.length) {
    console.log("No migrations need metadata baselining.");
    return;
  }

  console.log("Marking migrations as applied:");
  for (const result of pendingMetadata) {
    const resolve = await resolveMigrationApplied(projectRoot, result.migrationName);
    if (!resolve.ok) {
      console.error(`- ${result.migrationName}: failed`);
      console.error((resolve.stdout || resolve.stderr).trim());
      process.exitCode = 1;
      return;
    }
    console.log(`- ${result.migrationName}: applied`);
  }
  console.log("");
  console.log("Baseline complete. Run npx prisma migrate status and npx prisma migrate deploy to verify.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
