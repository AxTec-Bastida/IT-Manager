import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("Phase 85 UI polish guardrails", () => {
  it("documents semantic status colors and mobile accessibility expectations", async () => {
    const readme = await readFile(path.join(projectRoot, "README.md"), "utf8");
    const sop = await readFile(path.join(projectRoot, "docs", "BETA-SOP.md"), "utf8");

    for (const document of [readme, sop]) {
      expect(document).toContain("Phase 85 UI / UX Visual Polish + Accessibility");
      expect(document).toContain("Status color meanings");
      expect(document).toContain("Neutral/default");
      expect(document).toContain("Success/synced");
      expect(document).toContain("Warning/offline/pending");
      expect(document).toContain("Danger/conflict");
      expect(document.toLowerCase()).toContain("do not rely on color alone");
      expect(document.toLowerCase()).toContain("horizontal overflow at 320px");
      expect(document).toContain("Icon-only controls need accessible");
      expect(document).not.toContain("super-secret");
      expect(document).not.toContain("Phase84Pass123!");
    }
  });

  it("keeps shared badge tones semantic instead of one-off only", async () => {
    const badgeSource = await readFile(path.join(projectRoot, "components", "badge.tsx"), "utf8");
    const globals = await readFile(path.join(projectRoot, "app", "globals.css"), "utf8");
    const uiPatterns = await readFile(path.join(projectRoot, "components", "ui-patterns.tsx"), "utf8");
    const pageHeader = await readFile(path.join(projectRoot, "components", "page-header.tsx"), "utf8");

    expect(badgeSource).toContain("export type BadgeTone");
    expect(badgeSource).toContain("success");
    expect(badgeSource).toContain("warning");
    expect(badgeSource).toContain("danger");
    expect(badgeSource).toContain("offline");
    expect(badgeSource).toContain("conflict");
    expect(globals).toContain("--status-success-bg");
    expect(globals).toContain("--status-warning-bg");
    expect(globals).toContain("--status-danger-bg");
    expect(globals).toContain("--status-conflict-bg");
    expect(globals).toContain(".status-badge");
    expect(badgeSource).toContain("max-w-full break-words");
    expect(uiPatterns).toContain("[&_svg]:shrink-0");
    expect(uiPatterns).toContain("grid min-w-0 gap-2");
    expect(pageHeader).toContain("break-words text-[1.7rem]");
  });

  it("keeps offline conflict wording user-safe and technical details progressive", async () => {
    const queuePanel = await readFile(path.join(projectRoot, "components", "offline-queue-panel.tsx"), "utf8");
    const conflictsPage = await readFile(path.join(projectRoot, "app", "offline", "conflicts", "page.tsx"), "utf8");
    const conflictActions = await readFile(path.join(projectRoot, "components", "offline-conflict-actions.tsx"), "utf8");

    expect(queuePanel).toContain("No offline actions are waiting on this browser.");
    expect(queuePanel).toContain("Cancel queued action");
    expect(queuePanel).toContain("Local photo file is no longer available. Retake the photo before retrying.");
    expect(conflictsPage).toContain("Next safe step:");
    expect(conflictsPage).toContain("Technical details");
    expect(conflictActions).toContain("Add optional review note");
    expect(conflictActions).toContain("Retry photo uploads from the Offline Queue on the same browser/device");
  });

  it("documents the Phase 88 visual QA fallback and scoped polish", async () => {
    const readme = await readFile(path.join(projectRoot, "README.md"), "utf8");
    const sop = await readFile(path.join(projectRoot, "docs", "BETA-SOP.md"), "utf8");
    const offlinePage = await readFile(path.join(projectRoot, "app", "offline", "page.tsx"), "utf8");

    for (const document of [readme, sop]) {
      expect(document).toContain("Phase 88 Real Visual QA / Screenshot Polish");
      expect(document).toContain("temporary authenticated local session");
      expect(document).toContain("redirect-loop/browser-state issue");
      expect(document).toContain("Shared action buttons now");
      expect(document).toContain("Page headers");
      expect(document).not.toContain("SMTP_PASS=super-secret");
      expect(document).not.toContain("BITLOCKER_VAULT_SECRET=super-secret");
    }
    expect(offlinePage).toContain("{record.actionType} / {record.status}");
    expect(offlinePage).not.toContain("Â");
  });
});
