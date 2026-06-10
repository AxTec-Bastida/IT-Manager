import { describe, expect, it } from "vitest";
import {
  buildLegacyAliasCandidates,
  buildMobilePairingCleanupPlan,
  canClearImportedAssignedValue,
  isAssetLikeAssignedValue,
  isHumanLikeAssignedValue,
  mobileReferenceKeys,
} from "@/lib/mobile-legacy";
import { buildLegacyPreview } from "@/lib/legacy-import";
import { utils, write } from "xlsx";

function workbookBuffer(sheets: Record<string, unknown[][]>) {
  const workbook = utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), name);
  }
  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("mobile legacy assignment detection", () => {
  it("flags asset-like assigned values without flagging real people or IT department", () => {
    expect(isAssetLikeAssignedValue("TFGTI_iPodK130")).toBe(true);
    expect(isAssetLikeAssignedValue("GHT-SLD-720")).toBe(true);
    expect(isAssetLikeAssignedValue("NO ASIGNADO")).toBe(true);
    expect(isHumanLikeAssignedValue("Adir Ramirez")).toBe(true);
    expect(isHumanLikeAssignedValue("IT")).toBe(true);
    expect(isAssetLikeAssignedValue("Adir Ramirez")).toBe(false);
  });

  it("maps mobile references to safe lookup keys", () => {
    expect(mobileReferenceKeys("TFGTIJiPodK130")).toContain("GHT-IPO-130");
    expect(mobileReferenceKeys("TFGTIJiPhoneR26")).toContain("GHT-IPH-26");
  });

  it("creates aliases and an exact iPod/sled pairing while preserving real assignments", () => {
    const ipod = { id: "ipod-130", name: "iPod Touch", assetTag: "GHT-IPO-130", category: "TABLET", model: "iPod", assignedTo: null, notes: "Legacy A/N: 130 | Source: iPod row 10" };
    const sled = { id: "sled-10", name: "Sled 10", assetTag: "GHT-SLD-10", category: "OTHER", model: "PRO 5R 2D IPOD", assignedTo: "TFGTIJiPodK130", notes: "Legacy A/N: 10 | Source: Sled row 3" };
    const ipad = { id: "ipad-1", name: "iPad", assetTag: "GHT-IPA-1", category: "TABLET", model: "iPad", assignedTo: "Adir Ramirez", notes: "Source: iPad row 4" };
    const plan = buildMobilePairingCleanupPlan([ipod, sled, ipad]);

    expect(plan.suspiciousAssignments).toHaveLength(1);
    expect(plan.assignmentsToClear.map((item) => item.device.id)).toEqual(["sled-10"]);
    expect(plan.pairingsToCreate[0]).toMatchObject({ sourceDeviceId: "ipod-130", targetDeviceId: "sled-10", relationshipType: "IPOD_SLED_PAIR" });
    expect(plan.aliasesToCreate.some((alias) => alias.deviceId === "sled-10" && alias.value === "TFGTIJiPodK130")).toBe(true);
    expect(plan.suspiciousAssignments.some((item) => item.device.id === "ipad-1")).toBe(false);
  });

  it("does not clear values when a real employee/current assignment is linked", () => {
    expect(canClearImportedAssignedValue({ id: "1", name: "Sled", assetTag: "GHT-SLD-1", category: "OTHER", assignedTo: "TFGTIJiPodK130", employeeId: "emp-1", notes: "Source: Sled row 2" })).toBe(false);
    expect(canClearImportedAssignedValue({ id: "2", name: "Sled", assetTag: "GHT-SLD-2", category: "OTHER", assignedTo: "TFGTIJiPodK130", notes: "Source: Sled row 3", assignmentItems: [{ returnedAt: null }] })).toBe(false);
  });

  it("builds legacy aliases from notes without duplicates", () => {
    const aliases = buildLegacyAliasCandidates({ id: "dev-1", name: "Sled", assetTag: "GHT-SLD-10", category: "OTHER", assignedTo: "TFGTIJiPodK130", notes: "Legacy A/N: 10 | Source: Sled row 3" });
    expect(aliases.map((alias) => alias.aliasType)).toEqual(["OLD_AN", "LEGACY_ASSET_TAG"]);
  });
});

describe("mobile legacy importer mapping", () => {
  it("maps iPod labels and sled references to metadata instead of employees", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      iPod: [["OLD A/N", "Number", "NEW A/N", "Brand", "Model", "S/N", "Label DB", "Last Label", "A/N Sled", "Status"], [119, 130, "GHT-IPO-130", "APPLE", "iPod Touch", "SER-1", "TFGTI_iPodK130", "TFGTI_iPodK130", "GHT-SLD-10", "Operations"]],
    }), "sample.xlsx");
    const row = preview.rows[0];

    expect(row.data.assetTag).toBe("GHT-IPO-130");
    expect(row.data.assignedTo).toBeNull();
    expect(row.data.legacyAliases).toEqual(expect.arrayContaining([expect.objectContaining({ aliasType: "LABEL_DB", value: "TFGTI_iPodK130" })]));
    expect(row.data.relationshipCandidates).toEqual([expect.objectContaining({ relationshipType: "IPOD_SLED_PAIR", targetReference: "GHT-SLD-10" })]);
  });

  it("preserves human iPad assignments but drops asset-like values", () => {
    const preview = buildLegacyPreview(workbookBuffer({
      iPad: [["New ID", "A/N", "Brand", "Model", "S/N", "Assigned"], ["GHT-IPA-1", "OLD-1", "APPLE", "iPad", "SER-IPAD", "Adir Ramirez"], ["GHT-IPA-2", "OLD-2", "APPLE", "iPad", "SER-IPAD-2", "GHT-SLD-720"]],
    }), "sample.xlsx");

    expect(preview.rows[0].data.assignedTo).toBe("Adir Ramirez");
    expect(preview.rows[1].data.assignedTo).toBeNull();
  });
});
