import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readRepoFile(filePath: string) {
  return readFileSync(path.join(root, filePath), "utf8");
}

describe("performance audit guardrails", () => {
  it("keeps the devices API bounded and paginated", () => {
    const source = readRepoFile("app/api/devices/route.ts");

    expect(source).toContain("const defaultLimit = 50");
    expect(source).toContain("const maxLimit = 100");
    expect(source).toContain("take: limit");
    expect(source).toContain("skip: (page - 1) * limit");
    expect(source).toContain("pagination");
    expect(source).not.toContain("include: { ipRange: true }");
  });

  it("keeps data-quality JSON summary-first while preserving full detail as explicit opt-in", () => {
    const route = readRepoFile("app/api/data-quality/route.ts");
    const helper = readRepoFile("lib/data-quality.ts");

    expect(route).toContain("getDataQualityApiSummary()");
    expect(route).toContain("if (!detail)");
    expect(route).toContain('detail === "full"');
    expect(route).toContain("summarizeDataQualityReviewForApi(review)");
    expect(helper).toContain("payloadMode: \"summary\"");
    expect(helper).toContain("fullDetailUrl: \"/api/data-quality?detail=full\"");
    expect(helper).toContain("previewDetailUrl: \"/api/data-quality?detail=preview\"");
  });
});
