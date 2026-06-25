import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cameraPausedInBackgroundMessage } from "@/lib/camera";

const projectRoot = process.cwd();

async function readSource(...segments: string[]) {
  return readFile(path.join(projectRoot, ...segments), "utf8");
}

describe("Phase 90G Map/Zones clarity", () => {
  it("explains zones, map anchors, expected zones, and fixed asset movement alerts", async () => {
    const zones = await readSource("app", "zones", "page.tsx");
    const map = await readSource("app", "map", "page.tsx");
    const zoneDetail = await readSource("app", "zones", "[id]", "page.tsx");

    for (const source of [zones, map, zoneDetail]) {
      expect(source).toContain("FIXED_ASSET_MOVED");
    }

    expect(zones).toContain("What is a zone?");
    expect(zones).toContain("Zones vs. map anchors");
    expect(zones).toContain("Expected Location Zone");
    expect(zones).toContain("No location zones configured");
    expect(zones).toContain("Packing");
    expect(zones).toContain("Receiving");
    expect(zones).toContain("IT Cage");
    expect(zones).toContain('href="/admin/master-data"');
    expect(zones).toContain('href="/map"');

    expect(map).toContain("How Map and Zones work together");
    expect(map).toContain("No custom warehouse layout image is active yet.");
    expect(map).toContain("No location anchors configured yet.");
    expect(map).toContain('href="/zones"');
  });
});

describe("Phase 90G camera cleanup contracts", () => {
  it("uses a clear background pause message", () => {
    expect(cameraPausedInBackgroundMessage()).toBe("Camera paused while app was in the background. Tap Start camera to scan again.");
  });

  it("stops scan and photo camera streams on background/pagehide without auto-resume", async () => {
    const scanner = await readSource("components", "camera-scanner.tsx");
    const capture = await readSource("components", "camera-capture.tsx");

    for (const source of [scanner, capture]) {
      expect(source).toContain("visibilitychange");
      expect(source).toContain("pagehide");
      expect(source).toContain("cameraPausedInBackgroundMessage");
      expect(source).toContain("track.stop()");
      expect(source).toContain("srcObject = null");
    }

    expect(scanner).toContain("Start camera again");
    expect(scanner).toContain("restartToken");
  });
});

describe("Phase 90G navigation, preview, and docs", () => {
  it("keeps key canonical routes visible in nav/admin/settings without exposing secrets", async () => {
    const nav = await readSource("components", "nav.tsx");
    const admin = await readSource("app", "admin", "page.tsx");
    const settings = await readSource("app", "settings", "page.tsx");

    for (const route of ["/scan", "/devices", "/intake", "/assignments", "/loans", "/rma", "/stock", "/maintenance", "/reports", "/map", "/zones"]) {
      expect(nav).toContain(`href: "${route}"`);
    }

    expect(admin).toContain("Master Data");
    expect(admin).toContain("Network / IP Ranges");
    expect(admin).toContain("Email & Notifications");
    expect(settings).toContain("SMTP secrets reside strictly in environment variables");
    expect(settings).not.toContain("SMTP_PASS");
    expect(settings).not.toContain("BITLOCKER_VAULT_SECRET");
  });

  it("keeps legacy Resources links redirected to the canonical Tools routes", async () => {
    const resources = await readSource("app", "resources", "page.tsx");
    const newResource = await readSource("app", "resources", "new", "page.tsx");

    expect(resources).toContain('redirect("/tools")');
    expect(newResource).toContain('redirect("/tools/new")');
  });

  it("updates UI Preview Lab and docs for final beta readiness without secrets", async () => {
    const preview = await readSource("app", "admin", "ui-preview", "page.tsx");
    const readme = await readSource("README.md");
    const sop = await readSource("docs", "BETA-SOP.md");

    expect(preview).toContain("Phase 90G final beta readiness patterns");
    expect(preview).toContain("Map / Zones");
    expect(preview).toContain("Camera paused");
    expect(preview).toContain("Release readiness");

    for (const document of [readme, sop]) {
      expect(document).toContain("Phase 90G");
      expect(document).toContain("Canonical beta routes");
      expect(document).toContain("Camera paused while app was in the background. Tap Start camera to scan again.");
      expect(document).toContain("Real physical phone validation");
      expect(document).not.toContain("SMTP_PASS=super-secret");
      expect(document).not.toContain("BITLOCKER_VAULT_SECRET=super-secret");
      expect(document).not.toContain("recovery-key-plain-text");
    }
  });
});
