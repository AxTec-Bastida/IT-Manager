import {
  buildLabelPayload,
  normalizeLabelCodeType,
  normalizeLabelTemplate,
  validateLabelPayload,
  type LabelCodeType,
  type LabelItem,
  type LabelTemplate,
} from "@/lib/labels";

export type CalibrationPackType = "micro-device" | "scanner-sled" | "batch-sheet" | "standard-asset";
export type CalibrationDpi = "203" | "300";
export type CalibrationSizePreset = "micro-25x10" | "micro-30x10" | "small-25x12" | "standard-40x20" | "standard-50x25" | "batch-sheet";
export type CalibrationScale = "small" | "medium" | "large";

export type CalibrationSettings = {
  pack: CalibrationPackType;
  dpi: CalibrationDpi;
  sizePreset: CalibrationSizePreset;
  codeType: LabelCodeType;
  template: LabelTemplate;
  codeSize: CalibrationScale;
  textSize: CalibrationScale;
};

export type CalibrationPack = {
  type: CalibrationPackType;
  title: string;
  description: string;
  recommendedUse: string;
  defaultCodeType: LabelCodeType;
  defaultTemplate: LabelTemplate;
  defaultSizePreset: CalibrationSizePreset;
  items: LabelItem[];
};

const maxCalibrationLabels = 48;

export const calibrationPacks: Record<CalibrationPackType, CalibrationPack> = {
  "micro-device": {
    type: "micro-device",
    title: "Micro Device Test Pack",
    description: "Tiny labels for iPods and small mobile devices.",
    recommendedUse: "Use Data Matrix first. Try QR only if phone camera scanning matters more than label size.",
    defaultCodeType: "data_matrix",
    defaultTemplate: "micro_device",
    defaultSizePreset: "micro-25x10",
    items: ["S41", "S42", "S43", "J01", "J02"].map((value) => ({ assetTag: value, visibleText: value, encodedValue: value, existsInInventory: false })),
  },
  "scanner-sled": {
    type: "scanner-sled",
    title: "Scanner / Sled Test Pack",
    description: "Compact scanner and sled labels, including visible text that differs from scan output.",
    recommendedUse: "Verify that visible J-192 scans as Zebra-J192 before applying physical label aliases.",
    defaultCodeType: "data_matrix",
    defaultTemplate: "scanner_sled",
    defaultSizePreset: "small-25x12",
    items: [
      { assetTag: "S-23B", visibleText: "S-23B", encodedValue: "S-23B", existsInInventory: false },
      { assetTag: "S-24B", visibleText: "S-24B", encodedValue: "S-24B", existsInInventory: false },
      { assetTag: "Zebra-J192", visibleText: "J-192", encodedValue: "Zebra-J192", existsInInventory: false },
      { assetTag: "Zebra-J193", visibleText: "J-193", encodedValue: "Zebra-J193", existsInInventory: false },
    ],
  },
  "batch-sheet": {
    type: "batch-sheet",
    title: "Batch Sheet Test Pack",
    description: "A small K01-K24 sheet for checking scanner wedge output and sheet spacing.",
    recommendedUse: "Use batch sheet mode for calibration only; production batches can still be generated from /labels.",
    defaultCodeType: "data_matrix",
    defaultTemplate: "batch_sheet",
    defaultSizePreset: "batch-sheet",
    items: Array.from({ length: 24 }, (_, index) => {
      const value = `K${String(index + 1).padStart(2, "0")}`;
      return { assetTag: value, visibleText: value, encodedValue: value, existsInInventory: false };
    }),
  },
  "standard-asset": {
    type: "standard-asset",
    title: "Standard Asset Label Test Pack",
    description: "Larger asset labels for laptops, printers, scales, and other standard equipment.",
    recommendedUse: "Use QR or QR + Barcode for general asset lookup; test Code 128 only where labels are wide enough.",
    defaultCodeType: "qr_barcode",
    defaultTemplate: "standard",
    defaultSizePreset: "standard-40x20",
    items: ["GHT-LP-TEST1", "GHT-PRN-TEST1", "GHT-SCL-TEST1"].map((value) => ({ assetTag: value, visibleText: value, encodedValue: value, existsInInventory: false })),
  },
};

export const calibrationPackOptions = Object.keys(calibrationPacks) as CalibrationPackType[];

export function normalizeCalibrationPack(value?: string | null): CalibrationPackType {
  return value === "micro-device" || value === "scanner-sled" || value === "batch-sheet" || value === "standard-asset" ? value : "micro-device";
}

export function normalizeCalibrationDpi(value?: string | null): CalibrationDpi {
  return value === "300" ? "300" : "203";
}

export function normalizeCalibrationSizePreset(value?: string | null): CalibrationSizePreset {
  if (value === "micro-25x10" || value === "micro-30x10" || value === "small-25x12" || value === "standard-40x20" || value === "standard-50x25" || value === "batch-sheet") return value;
  return "micro-25x10";
}

export function normalizeCalibrationScale(value?: string | null): CalibrationScale {
  return value === "small" || value === "large" ? value : "medium";
}

export function calibrationSettingsFromQuery(query: Record<string, string | undefined | null>): CalibrationSettings {
  const pack = calibrationPacks[normalizeCalibrationPack(query.pack)];
  return {
    pack: pack.type,
    dpi: normalizeCalibrationDpi(query.dpi),
    sizePreset: normalizeCalibrationSizePreset(query.sizePreset ?? pack.defaultSizePreset),
    codeType: normalizeLabelCodeType(query.codeType ?? pack.defaultCodeType),
    template: normalizeLabelTemplate(query.template ?? pack.defaultTemplate),
    codeSize: normalizeCalibrationScale(query.codeSize),
    textSize: normalizeCalibrationScale(query.textSize),
  };
}

export function getCalibrationTestPack(packType?: string | null) {
  const pack = calibrationPacks[normalizeCalibrationPack(packType)];
  if (pack.items.length > maxCalibrationLabels) throw new Error(`Calibration pack is too large. Limit is ${maxCalibrationLabels} labels.`);
  const invalid = pack.items.find((item) => {
    const visible = validateLabelPayload(item.visibleText ?? item.assetTag);
    const encoded = validateLabelPayload(item.encodedValue ?? item.assetTag);
    return !visible.ok || !encoded.ok;
  });
  if (invalid) throw new Error(`Calibration value ${invalid.visibleText ?? invalid.assetTag} is not safe for labels.`);
  return pack;
}

export function calibrationExpectedOutputs(items: LabelItem[]) {
  return items.map((item) => {
    const payload = buildLabelPayload(item, { includeSerialText: false, includeSerialCode: false });
    if (!payload.ok) throw new Error(payload.message);
    return {
      visibleText: payload.visibleText,
      expectedScan: payload.primary,
      differs: payload.visibleText !== payload.primary,
    };
  });
}

export function compareCalibrationScan(scannedValue: string, expectedValues: string[]) {
  const value = scannedValue.trim();
  if (!value) return { status: "empty" as const, message: "Empty scan." };
  const match = expectedValues.find((expected) => expected.toLowerCase() === value.toLowerCase());
  if (match) return { status: "match" as const, message: `Match: ${match}` };
  return { status: "unexpected" as const, message: `Unexpected value: ${value}` };
}
