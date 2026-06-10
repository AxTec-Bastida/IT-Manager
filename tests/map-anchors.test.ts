import { describe, expect, it } from "vitest";
import { buildAnchorDisplayPath, pointToMapPercent } from "@/lib/map-anchors";

describe("map anchor helpers", () => {
  it("builds a location display path from anchor hierarchy", () => {
    expect(buildAnchorDisplayPath({ area: "Packing", department: "Outbound", station: "Line 3", locationLabel: "Pack 3" })).toBe("Packing / Outbound / Line 3");
    expect(buildAnchorDisplayPath({ displayPath: "North / Returns / Door 2", locationLabel: "Door 2" })).toBe("North / Returns / Door 2");
    expect(buildAnchorDisplayPath({ locationLabel: "IT Cage" })).toBe("IT Cage");
  });

  it("converts map click coordinates into bounded percentages", () => {
    expect(pointToMapPercent(150, 75, { left: 100, top: 50, width: 200, height: 100 })).toEqual({ x: 25, y: 25 });
    expect(pointToMapPercent(-100, 900, { left: 100, top: 50, width: 200, height: 100 })).toEqual({ x: 0, y: 100 });
    expect(pointToMapPercent(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 50, y: 50 });
  });
});
