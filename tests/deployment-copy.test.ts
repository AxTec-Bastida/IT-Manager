import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("local deployment copy script", () => {
  it("excludes generated folders, logs, backups, and env secrets by default", async () => {
    const script = await readFile(path.join(process.cwd(), "scripts", "copy-to-local-dev.ps1"), "utf8");

    expect(script).toContain('"node_modules"');
    expect(script).toContain('".next"');
    expect(script).toContain('Join-Path $SourceRoot "backups"');
    expect(script).toContain('"*.log"');
    expect(script).toContain('".env"');
    expect(script).toContain('".env.local"');
    expect(script).not.toContain('".env.*"');
    expect(script).toContain("IncludeEnv");
    expect(script).toContain("may contain secrets");
    expect(script).not.toContain("/MIR");
    expect(script).not.toContain("Remove-Item");
  });

  it("keeps Git history by default unless SkipGit is requested", async () => {
    const script = await readFile(path.join(process.cwd(), "scripts", "copy-to-local-dev.ps1"), "utf8");

    expect(script).toContain("SkipGit");
    expect(script).toContain('if ($SkipGit) { $excludedDirectories += ".git" }');
  });
});
