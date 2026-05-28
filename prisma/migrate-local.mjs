import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const dbPath = resolve("prisma/dev.db");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('CREATE TABLE IF NOT EXISTS "__LocalMigration" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');

const deviceTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Device'").get();
const appliedStmt = db.prepare('SELECT name FROM "__LocalMigration" WHERE name = ?');
const markStmt = db.prepare('INSERT OR IGNORE INTO "__LocalMigration" ("name") VALUES (?)');

if (deviceTableExists && !appliedStmt.get("000001_init")) {
  markStmt.run("000001_init");
}

const migrationsDir = resolve("prisma/migrations");
const migrationNames = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of migrationNames) {
  if (appliedStmt.get(name)) continue;
  const sqlPath = join(migrationsDir, name, "migration.sql");
  if (!existsSync(sqlPath)) continue;
  const migration = readFileSync(sqlPath, "utf8");
  db.exec(migration);
  markStmt.run(name);
  console.log(`Applied migration ${name}`);
}

db.close();

console.log(`Local SQLite database is up to date at ${dbPath}`);
