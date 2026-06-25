import QRCode from "qrcode";

export type LabelCodeType = "qr" | "barcode" | "qr_barcode" | "data_matrix";
export type LabelTemplate = "compact" | "standard" | "large" | "batch_sheet" | "micro_device" | "scanner_sled" | "2x2" | "4x6" | "small_asset" | "stock_shelf" | "sheet_labels";
export type LabelMode = "existing" | "range" | "manual" | "alias-linked" | "batch" | "stock";

export type LabelItem = {
  deviceId?: string;
  assetTag: string;
  visibleText?: string | null;
  encodedValue?: string | null;
  officialAssetTag?: string | null;
  serialNumber?: string | null;
  assetName?: string | null;
  existsInInventory?: boolean;
  matchNote?: string | null;
};

export type LabelOptions = {
  codeType?: LabelCodeType;
  template?: LabelTemplate;
  includeSerialText?: boolean;
  includeSerialCode?: boolean;
};

export type RangeInput = {
  prefix: string;
  start: number;
  end: number;
  padding: number;
  maxCount?: number;
};

export type BatchPatternInput = {
  visibleTemplate: string;
  encodedTemplate: string;
  start: number;
  end: number;
  padding: number;
  maxCount?: number;
};

const maxLabelPayloadLength = 96;
const safePayloadPattern = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,95}$/;
const safePrefixPattern = /^[A-Za-z0-9._:-]*$/;
const sensitivePattern = /\b(bitlocker|recovery\s*key|password|passwd|secret|smtp|factura|invoice|employee|private|credential|token|apikey|api_key|key)\b/i;
const safeTemplatePattern = /^[A-Za-z0-9._:/#\-\s{}]+$/;

export const labelTemplateConfig: Record<LabelTemplate, { label: string; widthDots: number; heightDots: number; qrScale: number; barcodeHeight: number }> = {
  compact: { label: "Compact", widthDots: 320, heightDots: 160, qrScale: 4, barcodeHeight: 44 },
  standard: { label: "Standard", widthDots: 406, heightDots: 203, qrScale: 5, barcodeHeight: 54 },
  large: { label: "Large", widthDots: 609, heightDots: 203, qrScale: 5, barcodeHeight: 62 },
  batch_sheet: { label: "Batch sheet", widthDots: 280, heightDots: 120, qrScale: 3, barcodeHeight: 34 },
  micro_device: { label: "Micro device", widthDots: 240, heightDots: 96, qrScale: 3, barcodeHeight: 28 },
  scanner_sled: { label: "Scanner / sled", widthDots: 320, heightDots: 140, qrScale: 4, barcodeHeight: 40 },
  "2x2": { label: "2x2 Square", widthDots: 400, heightDots: 400, qrScale: 6, barcodeHeight: 60 },
  "4x6": { label: "4x6 Large", widthDots: 812, heightDots: 1218, qrScale: 8, barcodeHeight: 120 },
  small_asset: { label: "Small asset tag", widthDots: 280, heightDots: 100, qrScale: 3, barcodeHeight: 24 },
  stock_shelf: { label: "Stock shelf label", widthDots: 400, heightDots: 200, qrScale: 5, barcodeHeight: 40 },
  sheet_labels: { label: "Sheet labels", widthDots: 300, heightDots: 150, qrScale: 4, barcodeHeight: 30 },
};

export function normalizeLabelCodeType(value?: string | null): LabelCodeType {
  if (value === "qr" || value === "barcode" || value === "qr_barcode" || value === "data_matrix") return value;
  return "qr_barcode";
}

export function normalizeLabelTemplate(value?: string | null): LabelTemplate {
  if (value === "compact" || value === "standard" || value === "large" || value === "batch_sheet" || value === "micro_device" || value === "scanner_sled" || value === "2x2" || value === "4x6" || value === "small_asset" || value === "stock_shelf" || value === "sheet_labels") return value as LabelTemplate;
  return "standard";
}

export function normalizeLabelOptions(input: Record<string, string | undefined | null>): Required<LabelOptions> {
  return {
    codeType: normalizeLabelCodeType(input.codeType),
    template: normalizeLabelTemplate(input.template),
    includeSerialText: input.includeSerialText !== "false",
    includeSerialCode: input.includeSerialCode === "true",
  };
}

export function isSafeLabelPayload(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed && trimmed.length <= maxLabelPayloadLength && safePayloadPattern.test(trimmed) && !sensitivePattern.test(trimmed));
}

export function validateLabelPayload(value: string, kind: "assetTag" | "serial" = "assetTag") {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false as const, message: `${kind === "assetTag" ? "Asset tag" : "Serial"} is required.` };
  if (trimmed.length > maxLabelPayloadLength) return { ok: false as const, message: "Label value is too long." };
  if (sensitivePattern.test(trimmed)) return { ok: false as const, message: "Label value looks sensitive and will not be encoded." };
  if (!safePayloadPattern.test(trimmed)) return { ok: false as const, message: "Label value contains unsupported characters." };
  return { ok: true as const, value: trimmed };
}

export function labelVisibleText(item: LabelItem) {
  return (item.visibleText?.trim() || item.assetTag.trim());
}

export function labelEncodedValue(item: LabelItem) {
  return (item.encodedValue?.trim() || item.assetTag.trim());
}

export function buildLabelPayload(item: LabelItem, options: LabelOptions = {}) {
  const visible = validateLabelPayload(labelVisibleText(item), "assetTag");
  if (!visible.ok) return { ...visible, message: `Visible text: ${visible.message}` };
  const primary = validateLabelPayload(labelEncodedValue(item), "assetTag");
  if (!primary.ok) return { ...primary, message: `Encoded value: ${primary.message}` };

  const includeSerialCode = options.includeSerialCode === true;
  const includeSerialText = options.includeSerialText !== false;
  const serialValue = item.serialNumber?.trim();
  const serial = serialValue ? validateLabelPayload(serialValue, "serial") : null;

  if (includeSerialCode && serial && !serial.ok) return serial;

  return {
    ok: true as const,
    primary: primary.value,
    encodedValue: primary.value,
    visibleText: visible.value,
    serialText: includeSerialText && serial?.ok ? serial.value : null,
    serialCode: includeSerialCode && serial?.ok ? serial.value : null,
  };
}

export function officialAssetTagText(item: LabelItem) {
  const official = item.officialAssetTag?.trim();
  return official && official !== item.assetTag ? official : null;
}

export function canGenerateAssetLabel(asset: { assetTag?: string | null }) {
  return Boolean(asset.assetTag && validateLabelPayload(asset.assetTag).ok);
}

export function generateRangeLabels(input: RangeInput): LabelItem[] {
  const maxCount = input.maxCount ?? 500;
  const prefix = input.prefix.trim();
  if (!safePrefixPattern.test(prefix)) throw new Error("Prefix can only use letters, numbers, dots, underscores, colons, or dashes.");
  if (!Number.isInteger(input.start) || !Number.isInteger(input.end)) throw new Error("Start and end must be whole numbers.");
  if (input.start > input.end) throw new Error("Start number must be less than or equal to end number.");
  if (input.padding < 0 || input.padding > 12) throw new Error("Padding must be between 0 and 12.");
  const count = input.end - input.start + 1;
  if (count < 1) throw new Error("Range must generate at least one label.");
  if (count > maxCount) throw new Error(`Range is ${count} labels. The current safety limit is ${maxCount}.`);

  const labels = Array.from({ length: count }, (_, index) => {
    const number = String(input.start + index).padStart(input.padding, "0");
    return { assetTag: `${prefix}${number}`, existsInInventory: false };
  });

  const invalid = labels.find((label) => !validateLabelPayload(label.assetTag).ok);
  if (invalid) throw new Error(`Generated value ${invalid.assetTag} is not safe for a label.`);
  return labels;
}

export function generateBatchPatternLabels(input: BatchPatternInput): LabelItem[] {
  const maxCount = input.maxCount ?? 1000;
  const visibleTemplate = normalizePatternTemplate(input.visibleTemplate || "{num}");
  const encodedTemplate = normalizePatternTemplate(input.encodedTemplate || input.visibleTemplate || "{num}");
  if (!Number.isInteger(input.start) || !Number.isInteger(input.end)) throw new Error("Start and end must be whole numbers.");
  if (input.start > input.end) throw new Error("Start number must be less than or equal to end number.");
  if (input.padding < 0 || input.padding > 12) throw new Error("Padding must be between 0 and 12.");
  const count = input.end - input.start + 1;
  if (count < 1) throw new Error("Batch must generate at least one label.");
  if (count > maxCount) throw new Error(`Batch is ${count} labels. The current safety limit is ${maxCount}.`);

  const seenVisible = new Set<string>();
  const seenEncoded = new Set<string>();
  const labels = Array.from({ length: count }, (_, index) => {
    const number = String(input.start + index).padStart(input.padding, "0");
    const visibleText = visibleTemplate.replaceAll("{num}", number);
    const encodedValue = encodedTemplate.replaceAll("{num}", number);
    const visibleValidation = validateLabelPayload(visibleText);
    if (!visibleValidation.ok) throw new Error(`${visibleText}: ${visibleValidation.message}`);
    const encodedValidation = validateLabelPayload(encodedValue);
    if (!encodedValidation.ok) throw new Error(`${encodedValue}: ${encodedValidation.message}`);
    const visibleKey = visibleValidation.value.toLowerCase();
    const encodedKey = encodedValidation.value.toLowerCase();
    if (seenVisible.has(visibleKey)) throw new Error(`Generated visible text ${visibleValidation.value} is duplicated in this batch.`);
    if (seenEncoded.has(encodedKey)) throw new Error(`Generated encoded value ${encodedValidation.value} is duplicated in this batch.`);
    seenVisible.add(visibleKey);
    seenEncoded.add(encodedKey);
    return {
      assetTag: encodedValidation.value,
      visibleText: visibleValidation.value,
      encodedValue: encodedValidation.value,
      existsInInventory: false,
      matchNote: "Free batch label (unlinked)",
    };
  });

  return labels;
}

export function parseManualLabelList(value: string, maxCount = 500): LabelItem[] {
  const seen = new Set<string>();
  const labels: LabelItem[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const assetTag = rawLine.trim();
    if (!assetTag || seen.has(assetTag.toLowerCase())) continue;
    const validation = validateLabelPayload(assetTag);
    if (!validation.ok) throw new Error(`${assetTag}: ${validation.message}`);
    seen.add(assetTag.toLowerCase());
    labels.push({ assetTag: validation.value, existsInInventory: false });
  }
  if (labels.length > maxCount) throw new Error(`Manual list has ${labels.length} labels. The current safety limit is ${maxCount}.`);
  return labels;
}

export function parseLabelTagList(value: string, maxCount = 500): LabelItem[] {
  const seen = new Set<string>();
  const labels: LabelItem[] = [];
  for (const rawTag of value.split(/[,\n\r]+/)) {
    const assetTag = rawTag.trim();
    if (!assetTag || seen.has(assetTag.toLowerCase())) continue;
    const validation = validateLabelPayload(assetTag);
    if (!validation.ok) throw new Error(`${assetTag}: ${validation.message}`);
    seen.add(assetTag.toLowerCase());
    labels.push({ assetTag: validation.value, existsInInventory: false });
  }
  if (labels.length > maxCount) throw new Error(`Label list has ${labels.length} tags. The current safety limit is ${maxCount}.`);
  return labels;
}

export function hasBoundedExistingLabelSelection(input: {
  selectedIds?: string[];
  tags?: string | null;
  q?: string | null;
  category?: string | null;
  status?: string | null;
}) {
  return Boolean(
    (input.selectedIds?.length ?? 0) > 0 ||
      input.tags?.trim() ||
      input.q?.trim() ||
      input.category?.trim() ||
      input.status?.trim(),
  );
}

function normalizePatternTemplate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Pattern template is required.");
  if (!trimmed.includes("{num}")) throw new Error("Pattern template must include {num}.");
  if (sensitivePattern.test(trimmed)) throw new Error("Pattern template looks sensitive and will not be encoded.");
  if (!safeTemplatePattern.test(trimmed)) throw new Error("Pattern template contains unsupported characters.");
  return trimmed.replace(/\s+/g, " ");
}

export function barcodeBars(value: string): Array<{ width: number; on: boolean }> {
  const normalized = value.trim();
  const bits: Array<{ width: number; on: boolean }> = [{ width: 2, on: true }];
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    for (let bit = 0; bit < 7; bit += 1) {
      bits.push({ width: ((code >> bit) & 1) ? 3 : 1, on: bit % 2 === 0 });
    }
    bits.push({ width: 1, on: false });
  }
  bits.push({ width: 2, on: true });
  return bits;
}

export async function qrDataUrl(value: string, size = 150) {
  const validation = validateLabelPayload(value);
  if (!validation.ok) throw new Error(validation.message);
  return QRCode.toDataURL(validation.value, { errorCorrectionLevel: "M", margin: 1, width: size });
}

function zplEscape(value: string) {
  return value.replace(/[\^~\r\n]/g, " ").trim();
}

function zplText(value: string, x: number, y: number, height = 28, width = 24) {
  return `^FO${x},${y}^A0N,${height},${width}^FD${zplEscape(value)}^FS`;
}

function zplQr(value: string, x: number, y: number, scale: number) {
  return `^FO${x},${y}^BQN,2,${scale}^FDLA,${zplEscape(value)}^FS`;
}

function zplDataMatrix(value: string, x: number, y: number, scale: number) {
  return `^FO${x},${y}^BXN,${scale},200^FD${zplEscape(value)}^FS`;
}

function zplBarcode(value: string, x: number, y: number, height: number) {
  return `^FO${x},${y}^BCN,${height},Y,N,N^FD${zplEscape(value)}^FS`;
}

export function buildZplLabels(items: LabelItem[], options: LabelOptions = {}) {
  const normalized = {
    codeType: options.codeType ?? "qr_barcode",
    template: options.template ?? "standard",
    includeSerialText: options.includeSerialText !== false,
    includeSerialCode: options.includeSerialCode === true,
  };
  const template = labelTemplateConfig[normalized.template];

  return items.map((item) => {
    const payload = buildLabelPayload(item, normalized);
    if (!payload.ok) throw new Error(payload.message);

    const lines = [`^XA`, `^PW${template.widthDots}`, `^LL${template.heightDots}`];
    if (normalized.codeType === "qr" || normalized.codeType === "qr_barcode") lines.push(zplQr(payload.primary, 18, 18, template.qrScale));
    if (normalized.codeType === "data_matrix") lines.push(zplDataMatrix(payload.primary, 18, 18, template.qrScale + 1));
    lines.push(zplText(payload.visibleText, normalized.codeType === "barcode" ? 18 : 150, 24, 32, 28));
    if (item.assetName) lines.push(zplText(item.assetName.slice(0, 28), normalized.codeType === "barcode" ? 18 : 150, 62, 20, 18));
    const official = officialAssetTagText(item);
    if (official) lines.push(zplText(`Asset tag: ${official}`.slice(0, 34), normalized.codeType === "barcode" ? 18 : 150, 82, 18, 16));
    if (normalized.codeType === "barcode" || normalized.codeType === "qr_barcode") {
      lines.push(zplBarcode(payload.primary, normalized.codeType === "barcode" ? 18 : 150, 92, template.barcodeHeight));
    }
    if (payload.visibleText !== payload.primary) lines.push(zplText(`Scan: ${payload.primary}`.slice(0, 34), normalized.codeType === "barcode" ? 18 : 150, 82, 18, 16));
    if (payload.serialText) lines.push(zplText(`Serial: ${payload.serialText}`, 18, template.heightDots - 34, 20, 18));
    if (payload.serialCode) lines.push(zplQr(payload.serialCode, template.widthDots - 92, template.heightDots - 96, 3));
    lines.push("^XZ");
    return lines.join("\n");
  }).join("\n");
}

export function labelFilename(prefix = "asset-labels") {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `${prefix}-${stamp}.zpl`;
}
