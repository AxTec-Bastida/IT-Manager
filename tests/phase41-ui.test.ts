import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chipButtonClass } from "@/lib/ui-classes";

const projectRoot = process.cwd();

describe("phase 41 mobile shell UI contracts", () => {
  it("makes chip selected, unselected, and disabled states visually distinct", () => {
    expect(chipButtonClass(true)).toContain("bg-slate-950");
    expect(chipButtonClass(true)).toContain("text-white");
    expect(chipButtonClass(false)).toContain("border-slate-300");
    expect(chipButtonClass(false)).toContain("bg-white");
    expect(chipButtonClass(false)).not.toContain("bg-slate-950");
    expect(chipButtonClass(false, true)).toContain("cursor-not-allowed");
    expect(chipButtonClass(false, true)).toContain("text-slate-400");
  });

  it("mobile More navigation has explicit close and expanded state controls", () => {
    const navSource = readFileSync(path.join(projectRoot, "components", "nav.tsx"), "utf8");

    expect(navSource).toContain("aria-expanded={moreOpen}");
    expect(navSource).toContain("setMoreOpen(false)");
    expect(navSource).toContain("Close navigation menu");
    expect(navSource).toContain('role="dialog"');
    expect(navSource).toContain("document.body.style.overflow");
  });

  it("asset detail uses non-stretching desktop layout and bottom padding for mobile sticky actions", () => {
    const pageSource = readFileSync(path.join(projectRoot, "app", "devices", "[id]", "page.tsx"), "utf8");

    expect(pageSource).toContain('className="space-y-6 pb-36 lg:pb-0"');
    expect(pageSource).toContain("grid items-start gap-4 xl:grid-cols-3");
    expect(pageSource).toContain("self-start space-y-4");
    expect(pageSource).toContain("overflow-hidden rounded-lg border border-slate-200 bg-slate-50");
  });
});
