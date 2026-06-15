import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const read = (file: string) => readFileSync(path.join(projectRoot, file), "utf8");

describe("Docker deployment support", () => {
  it("keeps runtime data and secrets out of the Docker build context", () => {
    const dockerignore = read(".dockerignore");

    expect(dockerignore).toContain("node_modules");
    expect(dockerignore).toContain(".next");
    expect(dockerignore).toContain(".git");
    expect(dockerignore).toContain(".env");
    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain("!.env.example");
    expect(dockerignore).toContain("backups");
    expect(dockerignore).toContain("uploads");
    expect(dockerignore).toContain("data");
    expect(dockerignore).toContain("Import-samples");
    expect(dockerignore).toContain("cleanup-*.json");
  });

  it("uses persistent Compose mounts and exposes port 3000", () => {
    const compose = read("docker-compose.yml");

    expect(compose).toContain("./data/prisma:/app/prisma");
    expect(compose).toContain("./data/uploads:/app/uploads");
    expect(compose).toContain("./data/backups:/app/backups");
    expect(compose).toContain('"3000:3000"');
    expect(compose).toContain("DATABASE_URL:");
    expect(compose).toContain("SESSION_SECRET:");
    expect(compose).toContain("APP_BASE_URL:");
    expect(compose).toContain("profiles: [\"jobs\"]");
    expect(compose).toContain("npm run jobs:run-due");
  });

  it("starts with Prisma generate, migrate deploy, and Next production start", () => {
    const dockerfile = read("Dockerfile");
    const entrypoint = read("scripts/docker-entrypoint.sh");

    expect(dockerfile).toContain("npm ci --omit=dev");
    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]');
    expect(entrypoint).toContain("npx prisma generate --schema=/app/prisma/schema.prisma");
    expect(entrypoint).toContain("npx prisma migrate deploy --schema=/app/prisma/schema.prisma");
    expect(entrypoint).not.toContain("migrate reset");
    expect(entrypoint).not.toContain("prisma:seed");
  });

  it("ships only placeholder Docker environment values", () => {
    const env = read("docker-compose.example.env");

    expect(env).toContain("SESSION_SECRET=replace-with-a-long-random-secret");
    expect(env).toContain("APP_BASE_URL=http://SERVER-IP:3000");
    expect(env).toContain("SMTP_PASS=");
    expect(env).not.toContain("abastida");
    expect(env).not.toContain("TechStyle");
    expect(env).not.toContain("password123");
  });

  it("documents backup, restore, and single-scheduler safety", () => {
    const readme = read("README.md");

    expect(readme).toContain("Docker / Docker Compose Deployment");
    expect(readme).toContain("docker compose exec app npm run backup");
    expect(readme).toContain("Restoring only the database without uploads can break photo/factura/map links.");
    expect(readme).toContain("Use exactly one scheduler method");
    expect(readme).toContain("Docker Desktop is required on Windows");
  });

  it("keeps Docker runtime data ignored by Git", () => {
    const gitignore = read(".gitignore");

    expect(gitignore).toContain("/data/");
    expect(gitignore).toContain("/uploads/");
    expect(gitignore).toContain("/backups/");
    expect(gitignore).toContain(".env.*");
  });
});
