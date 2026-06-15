import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectMigrationMetadata, parseMigrationRequirements, verifyMigrationRequirements } from "@/lib/prisma-baseline";

describe("Prisma baseline safety helpers", () => {
  it("parses renamed migration tables as their final table name", () => {
    const requirement = parseMigrationRequirements(
      "000003_example",
      `
      CREATE TABLE "new_Device" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "assetTag" TEXT,
        "employeeId" TEXT
      );
      ALTER TABLE "new_Device" RENAME TO "Device";
      ALTER TABLE "Device" ADD COLUMN "condition" TEXT NOT NULL DEFAULT 'GOOD';
      CREATE TABLE "Employee" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "fullName" TEXT NOT NULL
      );
      `,
    );

    expect(requirement.requiredTables).toEqual(["Device", "Employee"]);
    expect(requirement.requiredColumns.Device).toEqual(["assetTag", "condition", "employeeId", "id"]);
    expect(requirement.requiredColumns.Employee).toEqual(["fullName", "id"]);
  });

  it("verifies existing table and column footprints", async () => {
    const client = createMockSqliteClient({
      Device: ["id", "assetTag", "condition"],
      Employee: ["id", "fullName"],
    });

    const [result] = await verifyMigrationRequirements(client, [
      {
        migrationName: "000003_example",
        requiredTables: ["Device", "Employee"],
        requiredColumns: { Device: ["id", "assetTag", "condition"], Employee: ["id", "fullName"] },
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.missingTables).toEqual([]);
    expect(result.missingColumns).toEqual({});
  });

  it("reports missing tables or columns before baseline apply", async () => {
    const client = createMockSqliteClient({ Device: ["id", "assetTag"] });

    const [result] = await verifyMigrationRequirements(client, [
      {
        migrationName: "000018_example",
        requiredTables: ["Device", "InventoryAuditSession"],
        requiredColumns: { Device: ["id", "assetTag", "currentMapAnchorId"], InventoryAuditSession: ["id", "title"] },
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.missingTables).toEqual(["InventoryAuditSession"]);
    expect(result.missingColumns).toEqual({ Device: ["currentMapAnchorId"] });
  });

  it("detects whether Prisma migration metadata exists", async () => {
    const client = createMockSqliteClient({ Device: ["id"], _prisma_migrations: ["id", "migration_name"] }, ["000001_init"]);
    await expect(inspectMigrationMetadata(client)).resolves.toEqual({
      migrationTableExists: true,
      appliedMigrationNames: ["000001_init"],
    });
  });

  it("keeps the baseline script guarded and non-destructive", async () => {
    const script = await fs.readFile(path.join(process.cwd(), "scripts", "prisma-baseline-existing-db.ts"), "utf8");
    expect(script).toContain("CONFIRM_DB_BASELINE");
    expect(script).toContain("--confirm");
    expect(script).not.toMatch(/migrate\s+reset/i);
  });

  it("documents migration safety, Docker baseline impact, and production update order", async () => {
    const readme = await fs.readFile(path.join(process.cwd(), "README.md"), "utf8");
    expect(readme).toContain("P3005");
    expect(readme).toContain("npm run db:baseline:dry-run");
    expect(readme).toContain("npm run db:baseline:apply -- --confirm");
    expect(readme).toContain("If Docker is pointed at a new empty");
    expect(readme).toContain("npx prisma migrate deploy");
    expect(readme).toContain("Do not run `prisma migrate reset` against a copied real database.");
  });

  it("keeps .env and runtime data ignored", async () => {
    const gitignore = await fs.readFile(path.join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env\*/m);
    expect(gitignore).toContain("prisma/*.db");
    expect(gitignore).toContain("/uploads/");
    expect(gitignore).toContain("/backups/");
  });
});

function createMockSqliteClient(tables: Record<string, string[]>, appliedMigrationNames: string[] = []) {
  return {
    async $queryRawUnsafe(sql: string) {
      if (sql.includes("name='_prisma_migrations'")) {
        return tables._prisma_migrations ? [{ name: "_prisma_migrations" }] : [];
      }
      if (sql.includes("FROM _prisma_migrations")) {
        return appliedMigrationNames.map((migration_name) => ({ migration_name }));
      }
      if (sql.includes("FROM sqlite_master")) {
        return Object.keys(tables)
          .filter((name) => !name.startsWith("sqlite_"))
          .sort()
          .map((name) => ({ name }));
      }
      const pragmaMatch = sql.match(/PRAGMA table_info\("([^"]+)"\)/);
      if (pragmaMatch) {
        return (tables[pragmaMatch[1]] ?? []).map((name) => ({ name }));
      }
      throw new Error(`Unexpected SQL in mock: ${sql}`);
    },
  };
}
