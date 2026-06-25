import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

async function readDoc(name: string) {
  return readFile(path.join(projectRoot, "docs", name), "utf8");
}

describe("Phase 90I controlled beta execution docs", () => {
  it("creates the required beta punchlist and handoff documents", async () => {
    const docs = {
      punchlist: await readDoc("BETA-PUNCHLIST.md"),
      phone: await readDoc("PHONE-QA-CHECKLIST.md"),
      smtp: await readDoc("SMTP-QA-CHECKLIST.md"),
      bitlocker: await readDoc("BITLOCKER-SECRET-READINESS.md"),
      caddy: await readDoc("CADDY-HTTPS-READINESS.md"),
      routes: await readDoc("ROUTE-SMOKE-MATRIX.md"),
      handoff: await readDoc("BETA-TESTER-HANDOFF.md"),
    };

    expect(docs.punchlist).toContain("Controlled Team Beta");
    expect(docs.punchlist).toContain("CONDITIONAL GO");
    expect(docs.punchlist).toContain("Wider Rollout");
    expect(docs.punchlist).toContain("NO-GO");
    expect(docs.punchlist).toContain("BLK-PHONE-001");
    expect(docs.punchlist).toContain("BLK-SMTP-001");
    expect(docs.punchlist).toContain("BLK-BITLOCKER-001");

    expect(docs.phone).toContain("| Test ID | Device | Browser | Tester | Date | Result | Notes | Bug ID if failed |");
    expect(docs.phone).toContain("Camera paused while app was in the background. Tap Start camera to scan again.");
    expect(docs.smtp).toContain("| Test ID | SMTP Status | QA Recipient | Email Type | Result | EmailLog Status | Notes | Bug ID if failed |");
    expect(docs.smtp).toContain("Do not place SMTP credentials");
    expect(docs.bitlocker).toContain("| Test ID | Secret present? | Authorized user behavior | Unauthorized user behavior | Result | Notes | Bug ID if failed |");
    expect(docs.bitlocker).toContain("Do not paste `BITLOCKER_VAULT_SECRET`");
    expect(docs.caddy).toContain("| Test ID | Device | Network | URL | Result | Notes | Bug ID if failed |");
    expect(docs.routes).toContain("| Route | Expected unauthenticated behavior | Expected authenticated behavior | Status | Notes |");
    expect(docs.routes).toContain("/resources/new");
    expect(docs.handoff).toContain("https://warehouse-it.local");
    expect(docs.handoff).toContain("How To Report Bugs");
  });

  it("links Phase 90I docs from README and BETA SOP without overclaiming manual blockers", async () => {
    const readme = await readFile(path.join(projectRoot, "README.md"), "utf8");
    const sop = await readDoc("BETA-SOP.md");

    for (const document of [readme, sop]) {
      expect(document).toContain("Phase 90I");
      expect(document).toContain("docs/BETA-PUNCHLIST.md");
      expect(document).toContain("docs/PHONE-QA-CHECKLIST.md");
      expect(document).toContain("docs/SMTP-QA-CHECKLIST.md");
      expect(document).toContain("docs/BITLOCKER-SECRET-READINESS.md");
      expect(document).toContain("docs/CADDY-HTTPS-READINESS.md");
      expect(document).toContain("docs/ROUTE-SMOKE-MATRIX.md");
      expect(document).toContain("docs/BETA-TESTER-HANDOFF.md");
      expect(document).toContain("Wider Rollout");
      expect(document).toContain("NO-GO");
      expect(document).not.toContain("Real physical phone validation: PASS");
      expect(document).not.toContain("SMTP QA email: PASS");
      expect(document).not.toContain("BITLOCKER_VAULT_SECRET=super-secret");
    }
  });

  it("does not include obvious secret values in beta execution docs", async () => {
    const names = [
      "BETA-PUNCHLIST.md",
      "PHONE-QA-CHECKLIST.md",
      "SMTP-QA-CHECKLIST.md",
      "BITLOCKER-SECRET-READINESS.md",
      "CADDY-HTTPS-READINESS.md",
      "ROUTE-SMOKE-MATRIX.md",
      "BETA-TESTER-HANDOFF.md",
    ];
    for (const name of names) {
      const doc = await readDoc(name);
      expect(doc).not.toContain("SMTP_PASS=");
      expect(doc).not.toContain("BITLOCKER_VAULT_SECRET=");
      expect(doc).not.toContain("BEGIN PRIVATE KEY");
      expect(doc).not.toMatch(/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/);
    }
  });
});
