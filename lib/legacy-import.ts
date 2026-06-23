import { DeviceCategory, DeviceCondition, DeviceStatus, StockCategory, StockItemType } from "@prisma/client";
import { read, utils } from "xlsx";
import { normalizeMacAddress, validateIPv4 } from "./ip";
import { isAssetLikeAssignedValue, isHumanLikeAssignedValue } from "./mobile-legacy";
import { suggestStockCategory } from "./stock-classification";

export type LegacySheetKind = "asset" | "stock" | "factura" | "ipam" | "activity" | "helper";
export type LegacyImportAction = "create" | "update" | "skip";
export type LegacyImportTarget = "device" | "stockItem" | "factura" | "activity" | "ipam" | "helper";

export type ExistingLegacyRecords = {
  devices?: Array<{ id: string; name: string; assetTag: string | null; serialNumber: string | null; macAddress: string | null; ipAddress: string | null }>;
  stockItems?: Array<{ id: string; name: string; sku: string | null; category: StockCategory }>;
  facturas?: Array<{ id: string; facturaNumber: string }>;
};

export type LegacySheetSummary = {
  sheetName: string;
  kind: LegacySheetKind;
  defaultSelected: boolean;
  ignoredByDefault: boolean;
  rowCount: number;
  headerRow: number | null;
  columns: string[];
  warnings: string[];
};

export type LegacyPreviewRow = {
  id: string;
  sheetName: string;
  rowNumber: number;
  target: LegacyImportTarget;
  action: LegacyImportAction;
  ok: boolean;
  errors: string[];
  warnings: string[];
  duplicate?: { type: "assetTag" | "serialNumber" | "macAddress" | "ipAddress" | "stock" | "factura"; id?: string; label: string; warningOnly?: boolean };
  data: Record<string, unknown>;
  raw: Record<string, unknown>;
};

export type LegacyPreviewSummary = {
  sheetsDetected: number;
  sheetsSelected: number;
  rowsDetected: number;
  rowsToCreate: number;
  rowsToUpdate: number;
  rowsSkipped: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  duplicateRows: number;
  redactedNotes: number;
  skippedCommentLikeStockRows: number;
};

export type LegacyWorkbookPreview = {
  fileName: string;
  sheets: LegacySheetSummary[];
  rows: LegacyPreviewRow[];
  summary: LegacyPreviewSummary;
};

type SheetConfig = {
  kind: LegacySheetKind;
  defaultSelected: boolean;
  headerRow: number | null;
  category?: DeviceCategory;
  stockCategory?: StockCategory;
  stockItemType?: StockItemType;
};

const assetSheets = new Set([
  "Sled",
  "iPod",
  "iPhone",
  "iPad",
  "Tablet",
  "Laptop",
  "Desktop",
  "Monitor",
  "IMPF",
  "IMPT",
  "Scale",
  "Scanner",
  "ScannerBK",
  "Zebra Base",
  "Zebra Scanner",
  "ChargerBays",
  "PortHubs",
  "Teclado+Mouse",
  "Mouse",
  "Infraestructura",
  "Seguridad",
]);

const helperSheets = new Set(["Hoja 42", "Validate IP", "DBTAG", "CleanSN"]);

export const legacySheetConfigs: Record<string, SheetConfig> = {
  Solicitudes: { kind: "activity", defaultSelected: false, headerRow: null },
  Otros: { kind: "stock", defaultSelected: true, headerRow: 1, stockCategory: "OTHER", stockItemType: "SUPPLY" },
  "Hoja 42": { kind: "helper", defaultSelected: false, headerRow: null },
  "Validate IP": { kind: "helper", defaultSelected: false, headerRow: 1 },
  ImpInvoice: { kind: "factura", defaultSelected: true, headerRow: 1 },
  DBTAG: { kind: "helper", defaultSelected: false, headerRow: 1 },
  Sled: { kind: "asset", defaultSelected: true, headerRow: 1, category: "OTHER" },
  iPod: { kind: "asset", defaultSelected: true, headerRow: 1, category: "TABLET" },
  iPhone: { kind: "asset", defaultSelected: true, headerRow: 1, category: "PHONE" },
  iPad: { kind: "asset", defaultSelected: true, headerRow: 1, category: "TABLET" },
  Baterias: { kind: "stock", defaultSelected: true, headerRow: 2, stockCategory: "BATTERY", stockItemType: "CONSUMABLE" },
  Tablet: { kind: "asset", defaultSelected: true, headerRow: 1, category: "TABLET" },
  Candados: { kind: "stock", defaultSelected: false, headerRow: 1, stockCategory: "OTHER", stockItemType: "SUPPLY" },
  Laptop: { kind: "asset", defaultSelected: true, headerRow: 1, category: "LAPTOP" },
  Desktop: { kind: "asset", defaultSelected: true, headerRow: 1, category: "DESKTOP" },
  Monitor: { kind: "asset", defaultSelected: true, headerRow: 1, category: "MONITOR" },
  IMPF: { kind: "asset", defaultSelected: true, headerRow: 1, category: "MFP_PRINTER" },
  IMPT: { kind: "asset", defaultSelected: true, headerRow: 1, category: "THERMAL_PRINTER" },
  Scale: { kind: "asset", defaultSelected: true, headerRow: 1, category: "SCALE" },
  ScannerBK: { kind: "asset", defaultSelected: false, headerRow: 1, category: "SCANNER" },
  "Arm  Display Base": { kind: "stock", defaultSelected: true, headerRow: 2, stockCategory: "OTHER", stockItemType: "SUPPLY" },
  Scanner: { kind: "asset", defaultSelected: true, headerRow: 1, category: "SCANNER" },
  "Zebra Base": { kind: "asset", defaultSelected: true, headerRow: 1, category: "OTHER" },
  "Zebra Scanner": { kind: "asset", defaultSelected: true, headerRow: 1, category: "SCANNER" },
  ChargerBays: { kind: "asset", defaultSelected: true, headerRow: 1, category: "DOCKING_STATION" },
  PortHubs: { kind: "asset", defaultSelected: true, headerRow: 1, category: "DOCKING_STATION" },
  "Teclado+Mouse": { kind: "asset", defaultSelected: true, headerRow: 1, category: "OTHER" },
  Mouse: { kind: "asset", defaultSelected: true, headerRow: 1, category: "OTHER" },
  CleanSN: { kind: "helper", defaultSelected: false, headerRow: null },
  Consumibles: { kind: "stock", defaultSelected: true, headerRow: 6, stockCategory: "OTHER", stockItemType: "CONSUMABLE" },
  Infraestructura: { kind: "asset", defaultSelected: true, headerRow: 1, category: "OTHER" },
  Seguridad: { kind: "asset", defaultSelected: true, headerRow: 1, category: "OTHER" },
  IPs: { kind: "ipam", defaultSelected: false, headerRow: null },
};

const columnAliases: Record<string, string[]> = {
  assetTag: ["asset tag", "new id", "new a/n", "new an", "af", "old a/n", "new a/n", "id", "tag", "dbtag"],
  legacyAssetNumber: ["a/n", "an", "number", "#"],
  serialNumber: ["s/n", "sn", "serial", "serial number", "serie", "imp serie"],
  imei: ["imei"],
  deviceName: ["device", "equipo", "name", "nombre", "item", "padlock"],
  brand: ["brand", "marca"],
  model: ["model", "modelo"],
  invoice: ["invoice", "factura", "invoince"],
  vendor: ["vendor", "proveedor"],
  status: ["status", "estado"],
  assignedTo: ["assigned", "assigned to", "usuario", "asignado a", "user"],
  labelDb: ["label db", "db label"],
  lastLabel: ["last label"],
  sledReference: ["a/n sled", "an sled", "sled", "sled a/n"],
  area: ["area", "warehouse", "tool - crib", "tool crib", "cabinet", "company"],
  location: ["location", "ubicacion", "ubicación", "lacation/ status / comment", "location/ status / comment"],
  ipAddress: ["ip", "ip address"],
  macAddress: ["mac", "mac address"],
  notes: ["notes", "note", "notas", "comentarios", "location/status/comment", "location/ status / comment", "lacation/ status / comment", "notas impo", "comments"],
  quantity: ["qty", "qty real", "amount", "cantidad"],
  purchaseDate: ["arrival date", "fecha", "purchase date"],
  warrantyExpiresAt: ["garantia", "garantía", "warranty"],
  comodato: ["comodato"],
  bitlocker: ["bitlocker"],
  immex: ["immex"],
  company: ["company"],
  tipo: ["tipo"],
  turno: ["turno"],
  toner: ["toner"],
};

const formulaErrorValues = new Set(["#REF!", "#N/A", "#VALUE!", "#NAME?", "#DIV/0!", "#NULL!", "#NUM!"]);

export function classifyLegacySheet(sheetName: string): SheetConfig {
  if (legacySheetConfigs[sheetName]) return legacySheetConfigs[sheetName];
  if (assetSheets.has(sheetName)) return { kind: "asset", defaultSelected: true, headerRow: 1, category: "OTHER" };
  return { kind: "helper", defaultSelected: false, headerRow: null };
}

export function normalizeLegacyHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function matchLegacyColumn(header: string): string | null {
  const normalized = normalizeLegacyHeader(header);
  if (!normalized || normalized.startsWith("blank ")) return null;
  for (const [field, aliases] of Object.entries(columnAliases)) {
    if (aliases.some((alias) => normalized === normalizeLegacyHeader(alias))) return field;
  }
  if (normalized.includes("location") && normalized.includes("comment")) return "notes";
  if (normalized.includes("invoice") || normalized.includes("factura")) return "invoice";
  if (normalized.includes("serial")) return "serialNumber";
  return null;
}

export function redactSensitiveNote(value: string): { value: string; redacted: boolean } {
  const hasSecret = /(password|pass|pwd|token|api\s*key)\s*[:=]\s*([^,;|\s]+)/i.test(value);
  let redacted = false;
  let output = value;
  if (hasSecret) {
    output = output.replace(/(user|usuario|username|login)\s*[:=]\s*(.*?)(?=(password|pass|pwd|token|api\s*key)\s*[:=]|[,;|]|$)/gi, (_match, key) => {
      redacted = true;
      return `${key}: [REDACTED] `;
    });
  }
  output = output.replace(/(password|pass|pwd|token|api\s*key)\s*[:=]\s*([^,;|\s]+)/gi, (_match, key) => {
    redacted = true;
    return `${key}: [REDACTED]`;
  });
  return { value: output.replace(/\s+/g, " ").trim(), redacted };
}

export function sanitizeLegacyRawForAudit(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveNote(value).value;
  if (Array.isArray(value)) return value.map((entry) => sanitizeLegacyRawForAudit(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeLegacyRawForAudit(entry)]));
  }
  return value;
}

export function normalizeLegacyStatus(value?: string | null): { status: DeviceStatus; condition: DeviceCondition; rawStatus: string | null } {
  const rawStatus = cleanText(value);
  const normalized = rawStatus.toUpperCase();
  if (!normalized) return { status: "ACTIVE", condition: "GOOD", rawStatus: null };
  if (["MISSING", "NOT FOUND", "BUSCAR"].some((term) => normalized.includes(term))) return { status: "MISSING", condition: "NEEDS_REVIEW", rawStatus };
  if (normalized.includes("LOST")) return { status: "LOST", condition: "NEEDS_REVIEW", rawStatus };
  if (normalized.includes("DAMAGE") || normalized.includes("DAMAGED")) return { status: "ACTIVE", condition: "DAMAGED", rawStatus };
  if (normalized.includes("STOCK") || normalized.includes("WITH IT")) return { status: "AVAILABLE", condition: "GOOD", rawStatus };
  if (normalized.includes("LOAN")) return { status: "LOANED_OUT", condition: "GOOD", rawStatus };
  if (normalized.includes("RETIRED") || normalized.includes("DISPOSED")) return { status: "RETIRED", condition: "GOOD", rawStatus };
  return { status: "ACTIVE", condition: "GOOD", rawStatus };
}

export function inferLegacyCategory(sheetName: string, row: Record<string, unknown> = {}): DeviceCategory {
  const configured = classifyLegacySheet(sheetName).category;
  const text = `${sheetName} ${row.deviceName ?? ""} ${row.model ?? ""}`.toLowerCase();
  if (configured && !["Infraestructura", "Seguridad"].includes(sheetName)) return configured;
  if (sheetName === "Seguridad") {
    if (text.includes("camara") || text.includes("camera")) return "CAMERA";
    if (text.includes("nvr")) return "NVR";
  }
  if (text.includes("switch")) return "SWITCH";
  if (text.includes("ap") || text.includes("ubiquiti") || text.includes("u6") || text.includes("uap")) return "ACCESS_POINT";
  if (configured) return configured;
  return "OTHER";
}

export function isMobileAppleCategory(sheetName: string, category: DeviceCategory) {
  return ["iPod", "iPhone", "iPad", "Tablet"].includes(sheetName) || category === "PHONE" || category === "TABLET";
}

export function shouldAllowStaticTracking(category: DeviceCategory, ipAddress?: string | null) {
  return Boolean(ipAddress && ["SCALE", "THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"].includes(category));
}

export function detectAssetDuplicate(
  row: Pick<LegacyPreviewRow, "data">,
  existing: ExistingLegacyRecords = {},
): LegacyPreviewRow["duplicate"] | undefined {
  const data = row.data;
  const devices = existing.devices ?? [];
  const assetTag = stringOrNull(data.assetTag);
  const serialNumber = stringOrNull(data.serialNumber);
  const macAddress = stringOrNull(data.macAddress);
  const ipAddress = stringOrNull(data.ipAddress);
  const byTag = assetTag ? devices.find((device) => normalizeComparable(device.assetTag) === normalizeComparable(assetTag)) : null;
  if (byTag) return { type: "assetTag", id: byTag.id, label: byTag.name };
  const bySerial = serialNumber ? devices.find((device) => normalizeComparable(device.serialNumber) === normalizeComparable(serialNumber)) : null;
  if (bySerial) return { type: "serialNumber", id: bySerial.id, label: bySerial.name };
  const byMac = macAddress ? devices.find((device) => normalizeComparable(device.macAddress) === normalizeComparable(macAddress)) : null;
  if (byMac) return { type: "macAddress", id: byMac.id, label: byMac.name };
  const byIp = ipAddress ? devices.find((device) => normalizeComparable(device.ipAddress) === normalizeComparable(ipAddress)) : null;
  if (byIp) return { type: "ipAddress", id: byIp.id, label: byIp.name, warningOnly: true };
  return undefined;
}

export function detectStockDuplicate(
  row: Pick<LegacyPreviewRow, "data">,
  existing: ExistingLegacyRecords = {},
): LegacyPreviewRow["duplicate"] | undefined {
  const stockItems = existing.stockItems ?? [];
  const sku = stringOrNull(row.data.sku);
  const name = stringOrNull(row.data.name);
  const category = row.data.category as StockCategory | undefined;
  const bySku = sku ? stockItems.find((item) => normalizeComparable(item.sku) === normalizeComparable(sku)) : null;
  if (bySku) return { type: "stock", id: bySku.id, label: bySku.name };
  const byName = name ? stockItems.find((item) => normalizeComparable(item.name) === normalizeComparable(name) && item.category === category) : null;
  if (byName) return { type: "stock", id: byName.id, label: byName.name };
  return undefined;
}

export function buildLegacyPreview(
  workbookBuffer: Buffer,
  fileName: string,
  options: { selectedSheets?: string[]; existing?: ExistingLegacyRecords } = {},
): LegacyWorkbookPreview {
  const workbook = read(workbookBuffer, { type: "buffer", cellDates: true, cellFormula: false });
  const selected = new Set(options.selectedSheets ?? workbook.SheetNames.filter((name) => classifyLegacySheet(name).defaultSelected));
  const sheets = workbook.SheetNames.map((sheetName) => summarizeSheet(workbook, sheetName));
  const rows: LegacyPreviewRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const config = classifyLegacySheet(sheetName);
    if (!selected.has(sheetName)) continue;
    const parsedRows = parseSheetRows(workbook, sheetName, config);
    for (const row of parsedRows) {
      addDuplicateInfo(row, options.existing);
      rows.push(row);
    }
  }

  addInternalDuplicateWarnings(rows);
  return {
    fileName,
    sheets,
    rows,
    summary: summarizePreview(sheets, rows, selected),
  };
}

export function orderLegacyRowsForCommit(rows: LegacyPreviewRow[]) {
  const priority: Record<LegacyImportTarget, number> = {
    device: 0,
    stockItem: 1,
    factura: 2,
    activity: 3,
    ipam: 4,
    helper: 5,
  };
  return [...rows].sort((a, b) => priority[a.target] - priority[b.target]);
}

function summarizeSheet(workbook: ReturnType<typeof read>, sheetName: string): LegacySheetSummary {
  const sheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  const config = classifyLegacySheet(sheetName);
  const headerRow = config.headerRow;
  const columns = headerRow ? getHeaders(rows, headerRow, sheetName) : [];
  const warnings: string[] = [];
  if (helperSheets.has(sheetName)) warnings.push("Helper/check tab ignored by default.");
  if (sheetName === "ScannerBK") warnings.push("Hidden/backup scanner tab; import only when selected.");
  if (sheetName === "IPs") warnings.push("IP range data is unclear; preview only unless clean mapping is added.");
  if (columns.some((column) => !matchLegacyColumn(column) && !column.startsWith("Blank "))) warnings.push("Some columns need fallback handling or will be preserved only in raw metadata.");
  return {
    sheetName,
    kind: config.kind,
    defaultSelected: config.defaultSelected,
    ignoredByDefault: !config.defaultSelected,
    rowCount: Math.max(0, rows.filter((row) => row.some((cell) => cleanText(cell))).length - (headerRow ? 1 : 0)),
    headerRow,
    columns,
    warnings,
  };
}

function parseSheetRows(workbook: ReturnType<typeof read>, sheetName: string, config: SheetConfig): LegacyPreviewRow[] {
  const sheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  if (config.kind === "helper") {
    return [];
  }
  if (config.kind === "activity") return parseActivityRows(sheetName, rows);
  if (config.kind === "factura") return parseFacturaRows(sheetName, rows, config.headerRow ?? 1);
  if (config.kind === "ipam") return parseIpRows(sheetName, rows);

  const headers = getHeaders(rows, config.headerRow ?? 1, sheetName);
  const startIndex = (config.headerRow ?? 1);
  const parsed: LegacyPreviewRow[] = [];
  for (let index = startIndex; index < rows.length; index += 1) {
    const raw = rawObject(headers, rows[index]);
    if (countValues(raw) < 2) {
      if (config.kind === "stock" && isSparseCommentLikeStockRow(raw)) {
        parsed.push(mapStockSheetRow(sheetName, index + 1, raw, config));
      }
      continue;
    }
    if (shouldSkipLegacySideRow(sheetName, raw, config)) continue;
    parsed.push(config.kind === "stock" ? mapStockSheetRow(sheetName, index + 1, raw, config) : mapAssetSheetRow(sheetName, index + 1, raw));
  }
  return parsed;
}

function parseActivityRows(sheetName: string, rows: unknown[][]): LegacyPreviewRow[] {
  return rows
    .map((row, index) => ({ date: cleanText(row[0]), message: cleanText(row[1]), rowNumber: index + 1 }))
    .filter((row) => row.message)
    .map((row) => ({
      id: `${sheetName}:${row.rowNumber}`,
      sheetName,
      rowNumber: row.rowNumber,
      target: "activity",
      action: "create",
      ok: true,
      errors: [],
      warnings: ["Historical request will be imported as an ActivityLog note only."],
      data: { action: "legacy.request", entity: "legacy-import", message: row.message, metadata: JSON.stringify({ date: row.date, sourceSheet: sheetName, sourceRow: row.rowNumber }) },
      raw: { date: row.date, message: row.message },
    }));
}

function parseFacturaRows(sheetName: string, rows: unknown[][], headerRow: number): LegacyPreviewRow[] {
  const headers = getHeaders(rows, headerRow, sheetName);
  return rows.slice(headerRow).map((row, offset) => {
    const rowNumber = headerRow + offset + 1;
    const raw = rawObject(headers, row);
    if (countValues(raw) < 2) return null;
    const fields = matchedFields(raw);
    const facturaNumber = cleanText(fields.invoice);
    const serialNumber = cleanSerial(fields.serialNumber);
    const receivedDate = parseLegacyDate(fields.purchaseDate);
    const errors = facturaNumber ? [] : ["Factura number is required."];
    return {
      id: `${sheetName}:${rowNumber}`,
      sheetName,
      rowNumber,
      target: "factura" as const,
      action: "create" as const,
      ok: errors.length === 0,
      errors,
      warnings: serialNumber ? [`Will try to link serial ${serialNumber} to this factura.`] : [],
      data: {
        facturaNumber,
        vendorName: "Legacy import",
        receivedDate,
        notes: cleanText(fields.notes),
        serialNumber,
      },
      raw,
    };
  }).filter(Boolean) as LegacyPreviewRow[];
}

function parseIpRows(sheetName: string, rows: unknown[][]): LegacyPreviewRow[] {
  return rows.map((row, index) => {
    const rowNumber = index + 1;
    const lastOctet = cleanText(row[1]);
    const location = cleanText(row[2]);
    if (!lastOctet || !location || Number.isNaN(Number(lastOctet))) return null;
    const ipAddress = `192.168.163.${Number(lastOctet)}`;
    const ipValid = validateIPv4(ipAddress);
    return {
      id: `${sheetName}:${rowNumber}`,
      sheetName,
      rowNumber,
      target: "ipam" as const,
      action: "skip" as const,
      ok: ipValid.ok,
      errors: ipValid.ok ? [] : [ipValid.message],
      warnings: ["IP candidate preview only. This phase does not blindly create IpRange rows from the unclear IPs tab."],
      data: { ipAddress, location },
      raw: { type: cleanText(row[0]), lastOctet, location },
    };
  }).filter(Boolean) as LegacyPreviewRow[];
}

function mapAssetSheetRow(sheetName: string, rowNumber: number, raw: Record<string, unknown>): LegacyPreviewRow {
  const fields = matchedFields(raw);
  if (sheetName === "Laptop" && !fields.assetTag) fields.assetTag = firstRawValue(raw);
  applyLegacyAssetFallbacks(sheetName, raw, fields);
  const warnings: string[] = [];
  const errors: string[] = [];
  const legacyAssetNumber = cleanText(fields.legacyAssetNumber);
  const serialNumber = cleanSerial(fields.serialNumber);
  const mobileCurrentTag = mobileCurrentAssetTag(sheetName, raw, fields);
  const assetTag = mobileCurrentTag || cleanText(fields.assetTag) || (serialNumber ? "" : legacyAssetNumber);
  const category = inferLegacyCategory(sheetName, fields);
  const ipAddress = cleanFormulaValue(fields.ipAddress, warnings, "IP");
  const macAddress = normalizeMacAddress(cleanText(fields.macAddress));
  const ipValidation = ipAddress ? validateIPv4(ipAddress) : null;
  if (ipValidation && !ipValidation.ok) {
    warnings.push(`Invalid IP ignored: ${ipAddress}. ${ipValidation.message}`);
  }
  const status = normalizeLegacyStatus(cleanText(fields.status));
  const notePieces = [
    cleanText(fields.notes),
    cleanText(fields.comodato) ? `Comodato: ${cleanText(fields.comodato)}` : "",
    cleanText(fields.bitlocker) ? "Bitlocker noted in legacy workbook." : "",
    cleanText(fields.immex) ? `IMMEX: ${cleanText(fields.immex)}` : "",
    cleanText(fields.tipo) ? `Tipo: ${cleanText(fields.tipo)}` : "",
    cleanText(fields.turno) ? `Turno: ${cleanText(fields.turno)}` : "",
    cleanText(fields.toner) ? `Toner: ${cleanText(fields.toner)}` : "",
    legacyAssetNumber ? `Legacy A/N: ${legacyAssetNumber}` : "",
    status.rawStatus ? `Legacy status: ${status.rawStatus}` : "",
    `Source: ${sheetName} row ${rowNumber}`,
  ].filter(Boolean);
  const redacted = redactSensitiveNote(notePieces.join(" | "));
  if (redacted.redacted) warnings.push("Possible credential redacted from imported notes.");
  if (!assetTag && !serialNumber) errors.push("Asset row needs an asset tag or serial number.");
  if (isFormulaError(fields.serialNumber)) warnings.push("Formula error in serial column ignored.");

  const validIp = ipValidation?.ok ? ipAddress : null;
  const staticTracking = shouldAllowStaticTracking(category, validIp);
  const mobileApple = isMobileAppleCategory(sheetName, category);
  const assignedTo = cleanLegacyAssignedTo(sheetName, fields.assignedTo);
  const legacyAliases = buildLegacyAliasesForAssetRow(sheetName, rowNumber, raw, fields, legacyAssetNumber);
  const relationshipCandidates = buildLegacyRelationshipCandidates(sheetName, raw, fields);
  if (cleanText(fields.assignedTo) && !assignedTo) warnings.push("Assigned value looked like a legacy asset label or placeholder, not a person.");
  if (legacyAliases.length) warnings.push(`${legacyAliases.length} legacy alias value(s) will be stored for this asset.`);
  if (relationshipCandidates.length) warnings.push("Mobile/sled pairing candidate detected for review/import matching.");

  const data = {
    assetTag: assetTag || null,
    name: buildDeviceName(sheetName, category, assetTag, serialNumber, fields),
    category,
    brand: cleanText(fields.brand) || null,
    model: cleanText(fields.model) || null,
    serialNumber: serialNumber || null,
    ipAddress: mobileApple ? null : validIp,
    macAddress,
    location: cleanText(fields.location) || cleanText(fields.area) || null,
    areaDepartment: cleanText(fields.area) || null,
    assignedTo,
    status: status.status,
    condition: status.condition,
    purchaseDate: parseLegacyDate(fields.purchaseDate),
    warrantyExpiresAt: parseLegacyDate(fields.warrantyExpiresAt),
    notes: redacted.value || null,
    maintenanceNotes: category === "THERMAL_PRINTER" ? redacted.value || null : null,
    isFixedAsset: mobileApple ? false : staticTracking,
    usesStaticIp: mobileApple ? false : staticTracking,
    movementAlertsEnabled: false,
    invoiceNumber: cleanText(fields.invoice) || null,
    vendorName: cleanText(fields.vendor) || null,
    rawStatus: status.rawStatus,
    rawCategory: sheetName,
    legacyAssetNumber: legacyAssetNumber || null,
    legacyAliases,
    relationshipCandidates,
  };
  if (mobileApple) warnings.push("Mobile Apple/tablet asset imported without IP/MAC requirements or network tracking.");
  if (category === "SCALE" && validIp) warnings.push("Scale IP will be imported and static tracking can be enabled without UniFi.");

  return {
    id: `${sheetName}:${rowNumber}`,
    sheetName,
    rowNumber,
    target: "device",
    action: errors.length ? "skip" : "create",
    ok: errors.length === 0,
    errors,
    warnings,
    data,
    raw,
  };
}

function mapStockSheetRow(sheetName: string, rowNumber: number, raw: Record<string, unknown>, config: SheetConfig): LegacyPreviewRow {
  const fields = matchedFields(raw);
  const warnings: string[] = [];
  const { name, inferred } = buildStockName(sheetName, raw, fields);
  if (inferred) warnings.push("Stock item name inferred from legacy sheet layout.");
  const quantityValue = parseQuantity(fields.quantity);
  if (isCommentLikeStockImportRow({ name, quantity: quantityValue, fields })) {
    warnings.push("Skipped comment-like stock row from legacy workbook.");
    return {
      id: `${sheetName}:${rowNumber}`,
      sheetName,
      rowNumber,
      target: "stockItem",
      action: "skip",
      ok: true,
      errors: [],
      warnings,
      data: {
        name,
        quantityOnHand: quantityValue ?? 0,
        rawCategory: sheetName,
      },
      raw,
    };
  }
  if (quantityValue == null) warnings.push("Quantity missing; defaulting to 0.");
  const data = {
    name,
    sku: cleanText(fields.assetTag) || null,
    category: inferStockCategory(sheetName, name),
    itemType: config.stockItemType ?? "SUPPLY",
    quantityOnHand: quantityValue ?? 0,
    minimumQuantity: 0,
    vendorName: cleanText(fields.vendor) || null,
    storageLocation: cleanText(fields.location) || cleanText(fields.area) || null,
    notes: [cleanText(fields.notes), cleanText(fields.invoice) ? `Legacy factura: ${cleanText(fields.invoice)}` : "", `Source: ${sheetName} row ${rowNumber}`].filter(Boolean).join(" | ") || null,
  };
  const errors = name ? [] : ["Stock row needs an item name, brand/model, or ID."];
  return {
    id: `${sheetName}:${rowNumber}`,
    sheetName,
    rowNumber,
    target: "stockItem",
    action: errors.length ? "skip" : "create",
    ok: errors.length === 0,
    errors,
    warnings,
    data,
    raw,
  };
}

function shouldSkipLegacySideRow(sheetName: string, raw: Record<string, unknown>, config: SheetConfig) {
  if (config.kind !== "stock") return false;
  const fields = matchedFields(raw);
  const explicitName = [cleanText(fields.deviceName), cleanText(fields.brand), cleanText(fields.model), cleanText(fields.assetTag)].some(Boolean);
  if (explicitName) return false;

  if (sheetName === "Otros") return true;

  if (sheetName === "Baterias") {
    const hasAreaQuantity = Boolean(cleanText(fields.area) && parseQuantity(fields.quantity) != null);
    return !hasAreaQuantity;
  }

  if (sheetName === "Arm  Display Base") {
    const firstColumn = cleanText(raw["Blank 1"]);
    const amount = cleanText(fields.quantity).toLowerCase();
    const location = cleanText(fields.location).toLowerCase();
    return !firstColumn || amount === "amount" || location === "status";
  }

  return false;
}

function applyLegacyAssetFallbacks(sheetName: string, raw: Record<string, unknown>, fields: Record<string, unknown>) {
  if (sheetName !== "Infraestructura") return;
  if (cleanText(fields.serialNumber) || cleanText(fields.model) || cleanText(fields.deviceName)) return;

  const sideModel = cleanText(raw["Blank 12"]);
  const sideSerial = cleanText(raw["Blank 13"]);
  if (!sideModel || !sideSerial) return;

  fields.brand = fields.brand || "Ubiquiti";
  fields.model = sideModel;
  fields.deviceName = sideModel.toUpperCase().includes("U") ? "AP" : sideModel;
  fields.serialNumber = sideSerial;
  fields.macAddress = fields.macAddress || sideSerial;
  fields.notes = [cleanText(fields.notes), "Recovered from Infraestructura side table."].filter(Boolean).join(" | ");
}

function mobileCurrentAssetTag(sheetName: string, raw: Record<string, unknown>, fields: Record<string, unknown>) {
  if (sheetName === "iPod") return rawHeaderValue(raw, ["NEW A/N", "New A/N"]) || "";
  if (sheetName === "iPhone") return rawHeaderValue(raw, ["AF", "A/N"]) || "";
  if (sheetName === "iPad") return rawHeaderValue(raw, ["New ID", "NEW ID"]) || "";
  if (sheetName === "Sled") return rawHeaderValue(raw, ["New ID", "NEW ID"]) || "";
  return cleanText(fields.assetTag);
}

function cleanLegacyAssignedTo(sheetName: string, value: unknown) {
  const assigned = cleanText(value);
  if (!assigned) return null;
  if (isAssetLikeAssignedValue(assigned)) return null;
  if (["iPod", "iPhone", "Sled"].includes(sheetName)) return null;
  if (sheetName === "iPad") return isHumanLikeAssignedValue(assigned) ? assigned : null;
  return assigned;
}

function buildLegacyAliasesForAssetRow(sheetName: string, rowNumber: number, raw: Record<string, unknown>, fields: Record<string, unknown>, legacyAssetNumber: string) {
  const aliases: Array<{ aliasType: string; value: string; sourceSheet: string; sourceColumn: string; sourceRow: number }> = [];
  const add = (aliasType: string, value: unknown, sourceColumn: string) => {
    const text = cleanText(value);
    if (!text) return;
    aliases.push({ aliasType, value: text, sourceSheet: sheetName, sourceColumn, sourceRow: rowNumber });
  };

  if (sheetName === "iPod") {
    add("OLD_AN", rawHeaderValue(raw, ["OLD A/N", "Old A/N", "Number"]) || legacyAssetNumber, "OLD A/N");
    add("LABEL_DB", rawHeaderValue(raw, ["Label DB"]), "Label DB");
    add("LAST_LABEL", rawHeaderValue(raw, ["Last Label"]), "Last Label");
  } else if (sheetName === "iPhone") {
    add("OLD_AN", rawHeaderValue(raw, ["A/N"]), "A/N");
    add("LABEL_DB", rawHeaderValue(raw, ["Label DB"]), "Label DB");
    add("LAST_LABEL", rawHeaderValue(raw, ["Last Label"]), "Last Label");
  } else if (sheetName === "iPad") {
    add("OLD_AN", rawHeaderValue(raw, ["A/N"]), "A/N");
    add("LABEL_DB", rawHeaderValue(raw, ["Label DB"]), "Label DB");
    add("LAST_LABEL", rawHeaderValue(raw, ["Last Label"]), "Last Label");
  } else if (sheetName === "Sled") {
    add("OLD_AN", rawHeaderValue(raw, ["A/N"]) || legacyAssetNumber, "A/N");
  } else if (legacyAssetNumber) {
    add("OLD_AN", legacyAssetNumber, "A/N");
  }

  const assigned = cleanText(fields.assignedTo);
  if (assigned && isAssetLikeAssignedValue(assigned) && !["NO ASIGNADO", "NO ASIGNADA", "N/A", "#N/A"].includes(assigned.toUpperCase())) {
    add(assigned.toUpperCase().startsWith("TFG") ? "LEGACY_ASSET_TAG" : "LEGACY_LABEL", assigned, "Assigned");
  }

  const seen = new Set<string>();
  return aliases.filter((alias) => {
    const key = `${alias.aliasType}:${alias.value.toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildLegacyRelationshipCandidates(sheetName: string, raw: Record<string, unknown>, fields: Record<string, unknown>) {
  const candidates: Array<{ relationshipType: string; targetReference: string; sourceColumn: string; confidence: number }> = [];
  const sledReference = rawHeaderValue(raw, ["A/N Sled", "AN Sled"]) || cleanText(fields.sledReference);
  if (["iPod", "iPhone"].includes(sheetName) && sledReference) {
    candidates.push({
      relationshipType: sheetName === "iPhone" ? "IPHONE_SLED_PAIR" : "IPOD_SLED_PAIR",
      targetReference: sledReference,
      sourceColumn: "A/N Sled",
      confidence: 0.8,
    });
  }
  return candidates;
}

function rawHeaderValue(raw: Record<string, unknown>, headers: string[]) {
  const normalizedHeaders = headers.map(normalizeLegacyHeader);
  for (const [header, value] of Object.entries(raw)) {
    if (normalizedHeaders.includes(normalizeLegacyHeader(header))) return cleanText(value);
  }
  return "";
}

function buildStockName(sheetName: string, raw: Record<string, unknown>, fields: Record<string, unknown>) {
  const explicit = [cleanText(fields.deviceName), cleanText(fields.brand), cleanText(fields.model)].filter(Boolean).join(" ").trim() || cleanText(fields.assetTag);
  if (explicit) return { name: explicit, inferred: false };

  if (sheetName === "Baterias" && cleanText(fields.area) && parseQuantity(fields.quantity) != null) {
    return { name: "Baterias", inferred: true };
  }

  if (sheetName === "Arm  Display Base") {
    const firstColumn = cleanText(raw["Blank 1"]);
    if (firstColumn) {
      return {
        name: firstColumn.toLowerCase() === "assembled" ? "Arm Display Base Assembled" : firstColumn,
        inferred: true,
      };
    }
  }

  return { name: "", inferred: false };
}

function addDuplicateInfo(row: LegacyPreviewRow, existing?: ExistingLegacyRecords) {
  if (!existing) return;
  const duplicate = row.target === "device" ? detectAssetDuplicate(row, existing) : row.target === "stockItem" ? detectStockDuplicate(row, existing) : undefined;
  if (!duplicate) return;
  row.duplicate = duplicate;
  if (duplicate.warningOnly) {
    row.warnings.push(`IP already exists on ${duplicate.label}; IP match is warning-only.`);
    return;
  }
  row.action = "update";
  row.warnings.push(`Matched existing ${duplicate.type} on ${duplicate.label}; import will preview as update.`);
}

function addInternalDuplicateWarnings(rows: LegacyPreviewRow[]) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (row.target !== "device") continue;
    for (const key of ["assetTag", "serialNumber"] as const) {
      const value = normalizeComparable(row.data[key]);
      if (!value) continue;
      const token = `${key}:${value}`;
      if (seen.has(token)) {
        row.action = "skip";
        row.warnings.push(`Duplicate ${key} inside workbook; first seen at ${seen.get(token)}. This duplicate row will be skipped during import.`);
      } else seen.set(token, `${row.sheetName} row ${row.rowNumber}`);
    }
  }
}

function summarizePreview(sheets: LegacySheetSummary[], rows: LegacyPreviewRow[], selected: Set<string>): LegacyPreviewSummary {
  return {
    sheetsDetected: sheets.length,
    sheetsSelected: selected.size,
    rowsDetected: rows.length,
    rowsToCreate: rows.filter((row) => row.ok && row.action === "create").length,
    rowsToUpdate: rows.filter((row) => row.ok && row.action === "update").length,
    rowsSkipped: rows.filter((row) => row.action === "skip" || !row.ok).length,
    validRows: rows.filter((row) => row.ok).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    warningRows: rows.filter((row) => row.warnings.length > 0).length,
    duplicateRows: rows.filter((row) => row.duplicate || row.warnings.some((warning) => warning.toLowerCase().includes("duplicate"))).length,
    redactedNotes: rows.filter((row) => row.warnings.some((warning) => warning.includes("credential redacted"))).length,
    skippedCommentLikeStockRows: rows.filter((row) => row.warnings.some((warning) => warning.toLowerCase().includes("comment-like stock row"))).length,
  };
}

function getHeaders(rows: unknown[][], headerRow: number, sheetName: string) {
  const row = rows[headerRow - 1] ?? [];
  return row.map((value, index) => {
    const header = cleanText(value);
    if (sheetName === "Laptop" && index === 0) return "New ID";
    return header || `Blank ${index + 1}`;
  });
}

function rawObject(headers: string[], row: unknown[]) {
  const raw: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    raw[header] = normalizeCell(row[index]);
  });
  return raw;
}

function matchedFields(raw: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(raw)) {
    const field = matchLegacyColumn(header);
    if (!field || fields[field] != null && cleanText(fields[field])) continue;
    fields[field] = value;
  }
  return fields;
}

function normalizeCell(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (typeof value === "string") return value.replace(/\r?\n/g, " ").trim();
  return value ?? "";
}

function cleanText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function stringOrNull(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function normalizeComparable(value: unknown) {
  return cleanText(value).toUpperCase();
}

function cleanSerial(value: unknown) {
  const text = cleanFormulaValue(value, [], "Serial");
  if (!text || text === "N/A") return "";
  return text.replace(/\.0$/, "");
}

function cleanFormulaValue(value: unknown, warnings: string[], label: string) {
  const text = cleanText(value);
  if (formulaErrorValues.has(text.toUpperCase())) {
    warnings.push(`${label} has formula error ${text}; value ignored.`);
    return "";
  }
  return text;
}

function isFormulaError(value: unknown) {
  return formulaErrorValues.has(cleanText(value).toUpperCase());
}

function countValues(raw: Record<string, unknown>) {
  return Object.values(raw).filter((value) => cleanText(value)).length;
}

function firstRawValue(raw: Record<string, unknown>) {
  return Object.values(raw).map(cleanText).find(Boolean) ?? "";
}

function parseQuantity(value: unknown): number | null {
  const text = cleanText(value).replace(/,/g, "");
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.trunc(number));
}

function parseLegacyDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = cleanText(value);
  if (!text || formulaErrorValues.has(text.toUpperCase())) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDeviceName(sheetName: string, category: DeviceCategory, assetTag: string, serialNumber: string, fields: Record<string, unknown>) {
  const deviceName = cleanText(fields.deviceName);
  const brand = cleanText(fields.brand);
  const model = cleanText(fields.model);
  const label = assetTag || serialNumber || model || sheetName;
  const brandModel = [brand, model].filter(Boolean).join(" ").trim();
  if (sheetName === "Sled") return ["Sled", assetTag || serialNumber || brandModel].filter(Boolean).join(" ").trim() || "Sled";
  if (sheetName === "Laptop" && brandModel) return brandModel;
  if (category === "LAPTOP" && brandModel && deviceName.toUpperCase().startsWith("ACCESS POINT")) return brandModel;
  if (category === "ACCESS_POINT" && deviceName.toUpperCase() === "ACCESS POINT") return "ACCESS POINT";
  if (deviceName && !["SCANNER", "PRINTER", "SCALE", "CHARGER", "CHARGIN STATION", "ACCESS POINT"].includes(deviceName.toUpperCase())) return deviceName;
  return `${category.replaceAll("_", " ")} ${label}`.trim();
}

function isSparseCommentLikeStockRow(raw: Record<string, unknown>) {
  const fields = matchedFields(raw);
  const candidate = cleanText(fields.deviceName) || cleanText(fields.brand) || cleanText(fields.model) || cleanText(fields.assetTag) || firstRawValue(raw);
  return isCommentLikeStockImportRow({ name: candidate, quantity: parseQuantity(fields.quantity), fields });
}

function isCommentLikeStockImportRow(input: { name: string; quantity: number | null; fields: Record<string, unknown> }) {
  const normalized = cleanText(input.name).toLowerCase();
  if (!normalized) return false;
  const startsLikeComment = ["comentarios", "falta crear", "pendiente", "crear", "revisar", "todo", "need to create", "missing create", "to create"].some((pattern) => normalized.startsWith(pattern));
  if (!startsLikeComment) return false;
  const hasMeaningfulMappedValue = Boolean(
    (input.quantity && input.quantity > 0) ||
      cleanText(input.fields.assetTag) ||
      cleanText(input.fields.serialNumber) ||
      cleanText(input.fields.invoice),
  );
  return !hasMeaningfulMappedValue;
}

function inferStockCategory(sheetName: string, name: string): StockCategory {
  const text = `${sheetName} ${name}`.toLowerCase();
  const suggestion = suggestStockCategory({ name });
  if (suggestion) return suggestion.category;
  if (text.includes("battery") || text.includes("bateria")) return "BATTERY";
  if (text.includes("mouse")) return "MOUSE";
  if (text.includes("teclado") || text.includes("keyboard")) return "KEYBOARD";
  if (text.includes("toner")) return "TONER";
  if (text.includes("ribbon")) return "RIBBON";
  if (text.includes("cable")) return "CABLE";
  if (text.includes("adapter") || text.includes("cargador") || text.includes("charger")) return "ADAPTER";
  if (text.includes("printhead") || text.includes("tambor")) return "PRINTER_PART";
  return "OTHER";
}
