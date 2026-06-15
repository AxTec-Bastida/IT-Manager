import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { PrismaClient } from "@prisma/client";

const execFileAsync = promisify(execFile);

export type MigrationRequirement = {
  migrationName: string;
  requiredTables: string[];
  requiredColumns: Record<string, string[]>;
};

export type MigrationVerification = MigrationRequirement & {
  ok: boolean;
  missingTables: string[];
  missingColumns: Record<string, string[]>;
};

export type MigrationMetadataInspection = {
  migrationTableExists: boolean;
  appliedMigrationNames: string[];
};

export function parseMigrationRequirements(migrationName: string, sql: string): MigrationRequirement {
  const renameTargets = new Map<string, string>();
  for (const match of sql.matchAll(/ALTER\s+TABLE\s+"([^"]+)"\s+RENAME\s+TO\s+"([^"]+)"/gi)) {
    renameTargets.set(match[1], match[2]);
  }

  const tableColumns = new Map<string, Set<string>>();
  const addColumn = (tableName: string, columnName: string) => {
    const finalTableName = renameTargets.get(tableName) ?? tableName;
    if (/^sqlite_/i.test(finalTableName)) return;
    if (!tableColumns.has(finalTableName)) tableColumns.set(finalTableName, new Set());
    tableColumns.get(finalTableName)!.add(columnName);
  };

  for (const match of sql.matchAll(/CREATE\s+TABLE\s+"([^"]+)"\s*\(([\s\S]*?)\);/gi)) {
    const rawTableName = match[1];
    const tableName = renameTargets.get(rawTableName) ?? rawTableName;
    if (rawTableName.startsWith("_") || /^sqlite_/i.test(tableName)) continue;
    if (!tableColumns.has(tableName)) tableColumns.set(tableName, new Set());

    for (const columnMatch of match[2].matchAll(/^\s*"([^"]+)"\s+/gm)) {
      tableColumns.get(tableName)!.add(columnMatch[1]);
    }
  }

  for (const match of sql.matchAll(/ALTER\s+TABLE\s+"([^"]+)"\s+ADD\s+COLUMN\s+"([^"]+)"/gi)) {
    addColumn(match[1], match[2]);
  }

  return {
    migrationName,
    requiredTables: [...tableColumns.keys()].sort(),
    requiredColumns: Object.fromEntries([...tableColumns.entries()].map(([table, columns]) => [table, [...columns].sort()])),
  };
}

export async function loadMigrationRequirements(migrationsDir: string): Promise<MigrationRequirement[]> {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const requirements: MigrationRequirement[] = [];
  for (const migrationName of directories) {
    const sqlPath = path.join(migrationsDir, migrationName, "migration.sql");
    const sql = await fs.readFile(sqlPath, "utf8");
    requirements.push(parseMigrationRequirements(migrationName, sql));
  }
  return requirements;
}

export async function inspectMigrationMetadata(client: Pick<PrismaClient, "$queryRawUnsafe">): Promise<MigrationMetadataInspection> {
  const tableRows = await client.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'");
  const migrationTableExists = tableRows.length > 0;
  const appliedRows = migrationTableExists
    ? await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
        "SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name",
      )
    : [];

  return {
    migrationTableExists,
    appliedMigrationNames: appliedRows.map((row) => row.migration_name),
  };
}

export async function getDatabaseTableColumns(client: Pick<PrismaClient, "$queryRawUnsafe">) {
  const tableRows = await client.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tables = new Map<string, Set<string>>();
  for (const row of tableRows) {
    const escapedName = row.name.replace(/"/g, '""');
    const columns = await client.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${escapedName}")`);
    tables.set(row.name, new Set(columns.map((column) => column.name)));
  }
  return tables;
}

export async function verifyMigrationRequirements(client: Pick<PrismaClient, "$queryRawUnsafe">, requirements: MigrationRequirement[]) {
  const tableColumns = await getDatabaseTableColumns(client);
  return requirements.map<MigrationVerification>((requirement) => {
    const missingTables = requirement.requiredTables.filter((table) => !tableColumns.has(table));
    const missingColumns: Record<string, string[]> = {};

    for (const [table, columns] of Object.entries(requirement.requiredColumns)) {
      if (!tableColumns.has(table)) continue;
      const existingColumns = tableColumns.get(table)!;
      const missing = columns.filter((column) => !existingColumns.has(column));
      if (missing.length) missingColumns[table] = missing;
    }

    return {
      ...requirement,
      ok: missingTables.length === 0 && Object.keys(missingColumns).length === 0,
      missingTables,
      missingColumns,
    };
  });
}

export async function runPrismaMigrateStatus(projectRoot: string) {
  return runNpxPrisma(projectRoot, ["migrate", "status"]);
}

export async function resolveMigrationApplied(projectRoot: string, migrationName: string) {
  return runNpxPrisma(projectRoot, ["migrate", "resolve", "--applied", migrationName]);
}

async function runNpxPrisma(projectRoot: string, args: string[]) {
  const command = process.execPath;
  const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
  try {
    const result = await execFileAsync(command, [prismaCli, ...args], { cwd: projectRoot, windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 * 4 });
    return { ok: true, stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const typed = error as Error & { stdout?: string; stderr?: string; code?: number };
    return {
      ok: false,
      stdout: typed.stdout ?? "",
      stderr: typed.stderr ?? typed.message,
      exitCode: typeof typed.code === "number" ? typed.code : 1,
    };
  }
}
