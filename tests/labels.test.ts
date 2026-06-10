import { describe, expect, it } from "vitest";
import { parseScannedLabel } from "@/lib/scan-label";
import {
  buildLabelPayload,
  buildZplLabels,
  canGenerateAssetLabel,
  generateBatchPatternLabels,
  generateRangeLabels,
  hasBoundedExistingLabelSelection,
  parseLabelTagList,
  parseManualLabelList,
  validateLabelPayload,
} from "@/lib/labels";
import { calibrationExpectedOutputs, compareCalibrationScan, getCalibrationTestPack } from "@/lib/label-calibration";
import { aliasPreviewToLabelItems, buildAliasAssignmentPreview, labelItemForAsset } from "@/lib/label-aliases";

describe("asset label helpers", () => {
  it("uses asset tag as the primary payload and keeps serial separate", () => {
    const payload = buildLabelPayload(
      { assetTag: "GHT-LP-011", serialNumber: "SER-123", assetName: "DELL Latitude", existsInInventory: true },
      { includeSerialText: true, includeSerialCode: true },
    );

    expect(payload).toMatchObject({
      ok: true,
      primary: "GHT-LP-011",
      visibleText: "GHT-LP-011",
      encodedValue: "GHT-LP-011",
      serialText: "SER-123",
      serialCode: "SER-123",
    });
  });

  it("keeps visible label text separate from encoded scan value", () => {
    const payload = buildLabelPayload({ assetTag: "Zebra-J192", visibleText: "J-192", encodedValue: "Zebra-J192" });

    expect(payload).toMatchObject({
      ok: true,
      visibleText: "J-192",
      primary: "Zebra-J192",
      encodedValue: "Zebra-J192",
    });
  });

  it("does not include sensitive-looking values in label payloads", () => {
    expect(validateLabelPayload("BitLocker-Recovery-Key-123").ok).toBe(false);
    expect(validateLabelPayload("password:hello").ok).toBe(false);
  });

  it("generates padded and unpadded ranges", () => {
    expect(generateRangeLabels({ prefix: "J", start: 1, end: 3, padding: 3 }).map((item) => item.assetTag)).toEqual(["J001", "J002", "J003"]);
    expect(generateRangeLabels({ prefix: "Zebra-", start: 208, end: 212, padding: 0 }).map((item) => item.assetTag)).toEqual([
      "Zebra-208",
      "Zebra-209",
      "Zebra-210",
      "Zebra-211",
      "Zebra-212",
    ]);
  });

  it("generates batch sheet patterns with visible and encoded values", () => {
    const labels = generateBatchPatternLabels({
      visibleTemplate: "J-{num}",
      encodedTemplate: "Zebra-J{num}",
      start: 192,
      end: 194,
      padding: 0,
    });

    expect(labels.map((item) => [item.visibleText, item.encodedValue, item.existsInInventory])).toEqual([
      ["J-192", "Zebra-J192", false],
      ["J-193", "Zebra-J193", false],
      ["J-194", "Zebra-J194", false],
    ]);
    expect(labels[0].matchNote).toBe("Free batch label (unlinked)");
  });

  it("generates K01 through K24 and supports a 1000-label batch", () => {
    const small = generateBatchPatternLabels({ visibleTemplate: "K{num}", encodedTemplate: "K{num}", start: 1, end: 24, padding: 2 });
    expect(small).toHaveLength(24);
    expect(small[0].assetTag).toBe("K01");
    expect(small[23].assetTag).toBe("K24");

    const large = generateBatchPatternLabels({ visibleTemplate: "K{num}", encodedTemplate: "K{num}", start: 1, end: 1000, padding: 2 });
    expect(large).toHaveLength(1000);
    expect(large.at(-1)?.assetTag).toBe("K1000");
  });

  it("generates J001 to J100 for batch sheets", () => {
    const labels = generateBatchPatternLabels({ visibleTemplate: "J{num}", encodedTemplate: "J{num}", start: 1, end: 100, padding: 3 });
    expect(labels).toHaveLength(100);
    expect(labels[0].assetTag).toBe("J001");
    expect(labels.at(-1)?.assetTag).toBe("J100");
  });

  it("rejects invalid ranges", () => {
    expect(() => generateRangeLabels({ prefix: "J", start: 10, end: 1, padding: 3 })).toThrow("Start number");
    expect(() => generateRangeLabels({ prefix: "J", start: 1, end: 501, padding: 3 })).toThrow("safety limit");
  });

  it("rejects invalid, duplicate, and sensitive batch patterns", () => {
    expect(() => generateBatchPatternLabels({ visibleTemplate: "K{num}", encodedTemplate: "K{num}", start: 10, end: 1, padding: 2 })).toThrow("Start number");
    expect(() => generateBatchPatternLabels({ visibleTemplate: "K{num}", encodedTemplate: "K{num}", start: 1, end: 1001, padding: 2 })).toThrow("safety limit");
    expect(() => generateBatchPatternLabels({ visibleTemplate: "K", encodedTemplate: "K{num}", start: 1, end: 2, padding: 2 })).toThrow("{num}");
    expect(() => generateBatchPatternLabels({ visibleTemplate: "K{num}", encodedTemplate: "password-{num}", start: 1, end: 2, padding: 2 })).toThrow("sensitive");
  });

  it("deduplicates manual labels", () => {
    expect(parseManualLabelList("GHT-LP-011\nGHT-LP-011\nZebra-208\n").map((item) => item.assetTag)).toEqual(["GHT-LP-011", "Zebra-208"]);
  });

  it("parses bounded print tag lists without falling back to broad inventory labels", () => {
    expect(parseLabelTagList("GHT-LP-1,GHT-LP-1\nGHT-SLD-1").map((item) => item.assetTag)).toEqual(["GHT-LP-1", "GHT-SLD-1"]);
    expect(() => parseLabelTagList("password-secret")).toThrow("sensitive");
  });

  it("requires existing label exports to be selected or narrowed", () => {
    expect(hasBoundedExistingLabelSelection({ selectedIds: [], tags: "", q: "", category: "", status: "" })).toBe(false);
    expect(hasBoundedExistingLabelSelection({ selectedIds: ["asset-1"] })).toBe(true);
    expect(hasBoundedExistingLabelSelection({ tags: "GHT-LP-1" })).toBe(true);
    expect(hasBoundedExistingLabelSelection({ q: "GHT" })).toBe(true);
    expect(hasBoundedExistingLabelSelection({ category: "LAPTOP" })).toBe(true);
  });

  it("builds one ZPL label per asset tag with QR and Code 128 commands", () => {
    const zpl = buildZplLabels(
      [
        { assetTag: "GHT-LP-011", serialNumber: "SER-1", assetName: "DELL Latitude" },
        { assetTag: "Zebra-208" },
      ],
      { codeType: "qr_barcode", includeSerialText: true, includeSerialCode: true },
    );

    expect(zpl.match(/\^XA/g)).toHaveLength(2);
    expect(zpl).toContain("^BQN");
    expect(zpl).toContain("^BCN");
    expect(zpl).toContain("^FDLA,GHT-LP-011");
    expect(zpl).toContain("Serial: SER-1");
    expect(zpl).toContain("^FDLA,SER-1");
  });

  it("builds Data Matrix ZPL and prints visible text without mixing encoded values", () => {
    const zpl = buildZplLabels([{ assetTag: "Zebra-J192", visibleText: "J-192", encodedValue: "Zebra-J192" }], {
      codeType: "data_matrix",
      template: "batch_sheet",
    });

    expect(zpl.match(/\^XA/g)).toHaveLength(1);
    expect(zpl).toContain("^BX");
    expect(zpl).toContain("^FDZebra-J192");
    expect(zpl).toContain("^FDJ-192");
    expect(zpl).toContain("Scan: Zebra-J192");
  });

  it("builds one ZPL label per batch label", () => {
    const labels = generateBatchPatternLabels({ visibleTemplate: "K{num}", encodedTemplate: "K{num}", start: 1, end: 3, padding: 2 });
    const zpl = buildZplLabels(labels, { codeType: "qr_barcode", template: "batch_sheet" });

    expect(zpl.match(/\^XA/g)).toHaveLength(3);
    expect(zpl).toContain("^BQN");
    expect(zpl).toContain("^BCN");
  });

  it("omits serial from ZPL unless enabled", () => {
    const zpl = buildZplLabels([{ assetTag: "GHT-LP-011", serialNumber: "SER-1" }], { includeSerialText: false, includeSerialCode: false });
    expect(zpl).not.toContain("SER-1");
  });

  it("keeps generated asset tags compatible with Quick Scan lookup", () => {
    const parsed = parseScannedLabel("GHT-LP-011");
    expect(parsed.query).toBe("GHT-LP-011");
    expect(parsed.raw).toBe("GHT-LP-011");
  });

  it("can identify whether asset detail should show a label preview", () => {
    expect(canGenerateAssetLabel({ assetTag: "GHT-LP-011" })).toBe(true);
    expect(canGenerateAssetLabel({ assetTag: null })).toBe(false);
  });

  it("maps physical label ranges to selected assets while preserving official asset tags", () => {
    const preview = buildAliasAssignmentPreview(
      [
        { id: "sled-1", name: "Sled GHT-SLD-1", assetTag: "GHT-SLD-1", serialNumber: "SER-SLD-1" },
        { id: "sled-2", name: "Sled GHT-SLD-2", assetTag: "GHT-SLD-2", serialNumber: "SER-SLD-2" },
      ],
      { prefix: "J", start: 1, end: 2, padding: 2, aliasType: "PHYSICAL_LABEL" },
    );

    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error("Expected alias preview to be valid");
    expect(preview.rows.map((row) => [row.code, row.officialAssetTag])).toEqual([
      ["J01", "GHT-SLD-1"],
      ["J02", "GHT-SLD-2"],
    ]);
    expect(aliasPreviewToLabelItems(preview.rows)[0]).toMatchObject({
      assetTag: "J01",
      officialAssetTag: "GHT-SLD-1",
      matchNote: "Physical label alias",
    });
  });

  it("rejects duplicate physical labels that already belong to another asset", () => {
    const preview = buildAliasAssignmentPreview(
      [{ id: "asset-2", name: "Sled GHT-SLD-2", assetTag: "GHT-SLD-2" }],
      { prefix: "J", start: 1, end: 1, padding: 2, aliasType: "PHYSICAL_LABEL" },
      [{ deviceId: "asset-1", aliasType: "PHYSICAL_LABEL", value: "J01" }],
    );

    expect(preview.ok).toBe(false);
    expect(preview.rows[0].conflict).toContain("another asset");
  });

  it("uses physical label aliases only when requested for existing asset labels", () => {
    const asset = {
      id: "asset-1",
      name: "Sled GHT-SLD-1",
      assetTag: "GHT-SLD-1",
      serialNumber: "SER-SLD-1",
      aliases: [{ aliasType: "PHYSICAL_LABEL", value: "J01" }],
    };

    expect(labelItemForAsset(asset)?.assetTag).toBe("GHT-SLD-1");
    expect(labelItemForAsset(asset, { usePhysicalLabel: true })).toMatchObject({
      assetTag: "J01",
      officialAssetTag: "GHT-SLD-1",
    });
  });

  it("prints linked physical codes without mixing them into official tags", () => {
    const zpl = buildZplLabels(
      [{ assetTag: "J01", officialAssetTag: "GHT-SLD-1", serialNumber: "SER-SLD-1", assetName: "Sled GHT-SLD-1" }],
      { codeType: "qr_barcode", includeSerialText: true, includeSerialCode: false },
    );

    expect(zpl).toContain("^FDLA,J01");
    expect(zpl).toContain("^FDAsset tag: GHT-SLD-1");
    expect(zpl).toContain("Serial: SER-SLD-1");
  });

  it("builds bounded calibration test packs with expected sample values", () => {
    const micro = getCalibrationTestPack("micro-device");
    expect(micro.items.map((item) => item.assetTag)).toEqual(["S41", "S42", "S43", "J01", "J02"]);
    expect(micro.defaultCodeType).toBe("data_matrix");

    const scanner = getCalibrationTestPack("scanner-sled");
    expect(scanner.items.map((item) => [item.visibleText, item.encodedValue])).toContainEqual(["J-192", "Zebra-J192"]);

    const batch = getCalibrationTestPack("batch-sheet");
    expect(batch.items).toHaveLength(24);
    expect(batch.items[0].assetTag).toBe("K01");
    expect(batch.items.at(-1)?.assetTag).toBe("K24");

    const standard = getCalibrationTestPack("standard-asset");
    expect(standard.items.map((item) => item.assetTag)).toEqual(["GHT-LP-TEST1", "GHT-PRN-TEST1", "GHT-SCL-TEST1"]);
  });

  it("keeps calibration visible text and encoded scanner output explicit", () => {
    const expected = calibrationExpectedOutputs(getCalibrationTestPack("scanner-sled").items);

    expect(expected).toContainEqual({ visibleText: "J-192", expectedScan: "Zebra-J192", differs: true });
    expect(expected).toContainEqual({ visibleText: "S-23B", expectedScan: "S-23B", differs: false });
  });

  it("compares calibration scan box values without inventory lookup", () => {
    const expected = calibrationExpectedOutputs(getCalibrationTestPack("scanner-sled").items).map((item) => item.expectedScan);

    expect(compareCalibrationScan("", expected)).toMatchObject({ status: "empty" });
    expect(compareCalibrationScan("Zebra-J192", expected)).toMatchObject({ status: "match" });
    expect(compareCalibrationScan("J-192", expected)).toMatchObject({ status: "unexpected" });
  });

  it("generates Data Matrix, QR, and Code 128 ZPL for calibration packs", () => {
    const items = getCalibrationTestPack("scanner-sled").items;

    expect(buildZplLabels(items, { codeType: "data_matrix", template: "scanner_sled" })).toContain("^BX");
    expect(buildZplLabels(items, { codeType: "qr", template: "scanner_sled" })).toContain("^BQN");
    expect(buildZplLabels(items, { codeType: "barcode", template: "scanner_sled" })).toContain("^BC");
  });
});
