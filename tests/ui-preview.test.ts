import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

async function readSource(...segments: string[]) {
  return readFile(path.join(projectRoot, ...segments), "utf8");
}

describe("Phase 86 UI Preview Lab", () => {
  it("keeps the UI Preview Lab admin-only and static", async () => {
    const source = await readSource("app", "admin", "ui-preview", "page.tsx");

    expect(source).toContain('hasPageRole("ADMIN")');
    expect(source).toContain("UI Preview Lab is admin-only.");
    expect(source).toContain("does not mutate data");
    expect(source).not.toContain("prisma.");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("method=\"post\"");
    expect(source).not.toContain("action=\"/api");
  });

  it("renders the required static preview sections", async () => {
    const source = await readSource("app", "admin", "ui-preview", "page.tsx");

    for (const text of [
      "Color / Status Tokens",
      "Buttons",
      "Badges",
      "Cards and Empty States",
      "Alerts",
      "Forms",
      "Tables and Mobile Cards",
      "Offline Queue Examples",
      "Offline Conflict Examples",
      "Asset Status and Danger Zone",
      "Mobile Layout Stress Sample",
    ]) {
      expect(source).toContain(text);
    }
  });

  it("exposes semantic badge tones and shared action variants", async () => {
    const badgeSource = await readSource("components", "badge.tsx");
    const patternsSource = await readSource("components", "ui-patterns.tsx");

    for (const tone of ["pending", "synced", "conflict", "offline", "security", "maintenance", "inventory"]) {
      expect(badgeSource).toContain(`| "${tone}"`);
    }

    expect(patternsSource).toContain("export type ActionVariant");
    for (const variant of ["primary", "secondary", "subtle", "danger", "warning", "success", "ghost"]) {
      expect(patternsSource).toContain(`"${variant}"`);
    }
    expect(patternsSource).toContain("export function MetricCard");
    expect(patternsSource).toContain("export function AlertPanel");
  });

  it("links the preview lab from admin navigation and settings", async () => {
    const navSource = await readSource("components", "nav.tsx");
    const settingsSource = await readSource("app", "settings", "page.tsx");

    expect(navSource).toContain('href: "/admin/ui-preview"');
    expect(navSource).toContain('label: "UI Preview Lab"');
    expect(settingsSource).toContain('href="/admin/ui-preview"');
  });

  it("documents Phase 86 status color and accessibility rules", async () => {
    const readme = await readSource("README.md");
    const sop = await readSource("docs", "BETA-SOP.md");

    for (const document of [readme, sop]) {
      expect(document).toContain("Phase 86 Design System and UI Preview Lab");
      expect(document).toContain("/admin/ui-preview");
      expect(document.toLowerCase()).toContain("color is not the only status signal");
      expect(document).toContain("neutral, success, warning, danger, info, pending, synced, conflict, offline");
      expect(document.toLowerCase()).toContain("horizontal overflow at 320px");
      expect(document).not.toContain("super-secret");
      expect(document).not.toContain("Phase84Pass123!");
    }
  });
});
