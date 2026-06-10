import { describe, expect, it } from "vitest";
import {
  buildGhtLpLaptopCleanupPlan,
  ghtLpLaptopCleanupUpdateData,
  isGhtLpLatitudeLaptopCleanupCandidate,
} from "@/lib/ght-lp-cleanup";

const badLaptop = {
  id: "dev-1",
  name: "ACCESS POINT GHT-LP-1",
  category: "ACCESS_POINT",
  assetTag: "GHT-LP-1",
  serialNumber: "GCL7MG3",
  brand: "DELL",
  model: "Latitude 3520",
  status: "ACTIVE",
  condition: "DAMAGED",
  employee: { fullName: "Jane User", employeeId: "E-1" },
};

describe("GHT-LP imported laptop cleanup", () => {
  it("detects GHT-LP Dell Latitude records imported as access points", () => {
    expect(isGhtLpLatitudeLaptopCleanupCandidate(badLaptop)).toBe(true);
  });

  it("builds a dry-run plan without mutating the source object", () => {
    const source = { ...badLaptop };
    const plan = buildGhtLpLaptopCleanupPlan(source);

    expect(plan).toMatchObject({
      id: "dev-1",
      currentName: "ACCESS POINT GHT-LP-1",
      suggestedName: "DELL Latitude 3520",
      currentCategory: "ACCESS_POINT",
      suggestedCategory: "LAPTOP",
      assetTag: "GHT-LP-1",
      serialNumber: "GCL7MG3",
      assignedEmployee: "Jane User / E-1",
      status: "ACTIVE",
      condition: "DAMAGED",
    });
    expect(source.name).toBe("ACCESS POINT GHT-LP-1");
    expect(source.category).toBe("ACCESS_POINT");
  });

  it("only updates name and category while preserving identity and workflow fields", () => {
    const plan = buildGhtLpLaptopCleanupPlan(badLaptop);
    expect(plan).not.toBeNull();
    const update = ghtLpLaptopCleanupUpdateData(plan!);

    expect(update).toEqual({ name: "DELL Latitude 3520", category: "LAPTOP" });
    expect(Object.keys(update)).toEqual(["name", "category"]);
    expect(plan?.assetTag).toBe("GHT-LP-1");
    expect(plan?.serialNumber).toBe("GCL7MG3");
    expect(plan?.status).toBe("ACTIVE");
    expect(plan?.condition).toBe("DAMAGED");
  });

  it("does not change real infrastructure access points", () => {
    const realAp = {
      ...badLaptop,
      id: "ap-1",
      name: "ACCESS POINT GHT-AP-1",
      assetTag: "GHT-AP-1",
      brand: "Ubiquiti",
      model: "U6-LR",
      category: "ACCESS_POINT",
    };

    expect(isGhtLpLatitudeLaptopCleanupCandidate(realAp)).toBe(false);
    expect(buildGhtLpLaptopCleanupPlan(realAp)).toBeNull();
  });

  it("detects GHT-LP Dell laptop records even when the model is not Latitude", () => {
    const proLaptop = { ...badLaptop, name: "ACCESS POINT GHT-LP-82", assetTag: "GHT-LP-82", model: "Pro 16", brand: "DELL" };

    expect(isGhtLpLatitudeLaptopCleanupCandidate(proLaptop)).toBe(true);
    expect(buildGhtLpLaptopCleanupPlan(proLaptop)?.suggestedName).toBe("DELL Pro 16");
  });

  it("does not change GHT-LP records without a clear Dell or Latitude laptop signal", () => {
    const ambiguous = { ...badLaptop, model: "Unknown", brand: "Unknown" };

    expect(isGhtLpLatitudeLaptopCleanupCandidate(ambiguous)).toBe(false);
    expect(buildGhtLpLaptopCleanupPlan(ambiguous)).toBeNull();
  });
});
