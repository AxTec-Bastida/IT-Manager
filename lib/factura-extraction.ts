import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Factura } from "@prisma/client";
import { ClientInputError } from "@/lib/api";
import { uploadStoragePath } from "@/lib/uploads";

const execFileAsync = promisify(execFile);

export type FacturaExtractionCandidate = {
  description: string;
  sku?: string | null;
  model?: string | null;
  quantity?: number | null;
  unitCost?: number | null;
  totalCost?: number | null;
  currency: string;
  confidence: number;
  rawTextSnippet: string;
  warnings: string[];
};

export type FacturaExtractionResult = {
  status: "SUCCESS" | "NO_TEXT";
  textLength: number;
  candidates: FacturaExtractionCandidate[];
  warnings: string[];
};

type ExtractableFactura = Pick<Factura, "id" | "storedFilename" | "filePath" | "mimeType" | "originalFilename">;

const totalLinePattern = /\b(subtotal|sub total|iva|impuesto|tax|total|gran total|amount due|balance due|saldo)\b/i;
const currencyPattern = /\b(MXN|USD|CAD)\b|\$\s*/i;

export function resolveFacturaUploadPath(factura: ExtractableFactura) {
  if (!factura.storedFilename && !factura.filePath) {
    throw new ClientInputError("Factura has no attached file to extract.", 422);
  }
  const storedFilename = factura.storedFilename || factura.filePath?.split("/").pop() || "";
  if (!storedFilename) throw new ClientInputError("Factura attachment is missing a stored filename.", 422);
  return uploadStoragePath("facturas", storedFilename);
}

export async function extractFacturaText(factura: ExtractableFactura) {
  const mimeType = factura.mimeType || "";
  const filePath = resolveFacturaUploadPath(factura);
  if (mimeType && mimeType !== "application/pdf" && !mimeType.startsWith("text/")) {
    throw new ClientInputError("Only selectable-text PDF factura files are supported in this phase. Scanned images require manual line item entry.", 422);
  }
  if (mimeType.startsWith("text/")) {
    const { readFile } = await import("node:fs/promises");
    return readFile(filePath, "utf8");
  }
  try {
    const { stdout } = await execFileAsync(process.env.PDFTOTEXT_PATH || "pdftotext", ["-enc", "UTF-8", "-layout", "-nopgbrk", filePath, "-"], {
      maxBuffer: 5 * 1024 * 1024,
      timeout: 20_000,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error.";
    throw new ClientInputError(`Could not extract selectable text from this factura PDF. ${message}`, 422);
  }
}

export async function extractFacturaCandidates(factura: ExtractableFactura): Promise<FacturaExtractionResult> {
  const text = await extractFacturaText(factura);
  const candidates = parseFacturaLineItemCandidates(text);
  const warnings: string[] = [];
  if (!text.trim()) warnings.push("No selectable text found. This may be a scanned/image-only PDF.");
  if (text.trim() && !candidates.length) warnings.push("Selectable text was found, but no safe line item candidates were detected.");
  return {
    status: text.trim() ? "SUCCESS" : "NO_TEXT",
    textLength: text.length,
    candidates,
    warnings,
  };
}

export function parseFacturaLineItemCandidates(text: string): FacturaExtractionCandidate[] {
  const candidates: FacturaExtractionCandidate[] = [];
  const seen = new Set<string>();
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 8);

  for (const line of lines) {
    const candidate = parseCandidateLine(line);
    if (!candidate) continue;
    const key = `${candidate.description.toLowerCase()}|${candidate.quantity ?? ""}|${candidate.unitCost ?? ""}|${candidate.totalCost ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  return candidates.slice(0, 80);
}

export function parseMoneyValue(value: string) {
  let text = value
    .replace(/\b(MXN|USD|CAD)\b/gi, "")
    .replace(/[$,\s]/g, (match) => (match === "," ? "," : ""))
    .trim();
  if (!text) return null;
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    text = comma > dot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = text.length - comma - 1;
    text = decimals > 0 && decimals <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  }
  const parsed = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function parseCandidateLine(line: string): FacturaExtractionCandidate | null {
  if (totalLinePattern.test(line)) return null;
  const tokens = line.split(/\s+/);
  if (tokens.length < 4) return null;

  const currency = detectCurrency(line);
  const numericIndexes = tokens
    .map((token, index) => ({ index, value: parseMoneyValue(token) }))
    .filter((item): item is { index: number; value: number } => item.value != null);

  if (numericIndexes.length < 2) return null;
  const lastNumbers = numericIndexes.slice(-3);
  const quantityNumber = lastNumbers.length >= 3 ? lastNumbers[0] : null;
  const unitNumber = lastNumbers.length >= 3 ? lastNumbers[1] : null;
  const totalNumber = lastNumbers.length >= 3 ? lastNumbers[2] : lastNumbers.at(-1);
  let quantity = quantityNumber && Number.isInteger(quantityNumber.value) && quantityNumber.value > 0 && quantityNumber.value < 10000 ? quantityNumber.value : null;
  let unitCost = unitNumber?.value ?? null;
  let totalCost = totalNumber?.value ?? null;

  const xMatch = line.match(/^(.+?)\s+(\d{1,5})\s*(?:x|@)\s*([$\d.,]+)(?:\s+([$\d.,]+))?\s*$/i);
  let descriptionEndIndex = quantityNumber?.index ?? numericIndexes[0].index;
  if (xMatch) {
    quantity = Number(xMatch[2]);
    unitCost = parseMoneyValue(xMatch[3]);
    totalCost = xMatch[4] ? parseMoneyValue(xMatch[4]) : unitCost && quantity ? roundCurrency(unitCost * quantity) : null;
    descriptionEndIndex = -1;
  }

  const description = cleanDescription(xMatch?.[1] ?? tokens.slice(0, descriptionEndIndex).join(" "));
  if (!description || description.length < 3) return null;
  if (looksLikeInvoiceMetadata(description)) return null;

  const warnings: string[] = [];
  if (!quantity || !unitCost) warnings.push("Quantity or unit cost is missing; review before creating.");
  if (quantity && unitCost && totalCost != null && Math.abs(roundCurrency(quantity * unitCost) - totalCost) > 0.05) warnings.push("Quantity times unit cost does not match detected total.");
  const sku = detectSku(description);
  const model = detectModel(description);
  if (!sku && !model) warnings.push("No SKU/model detected.");

  const confidence = Math.max(
    0.25,
    Math.min(
      0.95,
      0.35 +
        (quantity ? 0.18 : 0) +
        (unitCost != null ? 0.18 : 0) +
        (totalCost != null ? 0.14 : 0) +
        (warnings.some((warning) => warning.includes("does not match")) ? -0.25 : 0) +
        (sku || model ? 0.1 : 0),
    ),
  );

  return {
    description,
    sku,
    model,
    quantity,
    unitCost,
    totalCost,
    currency,
    confidence: roundCurrency(confidence),
    rawTextSnippet: line.slice(0, 240),
    warnings,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanDescription(value: string) {
  return normalizeWhitespace(value)
    .replace(/^\d+\s*[-.)]\s*/, "")
    .replace(/\b(?:MXN|USD|CAD)\b/gi, "")
    .trim();
}

function detectCurrency(value: string) {
  const match = value.match(currencyPattern);
  if (!match) return "MXN";
  const text = match[0].toUpperCase();
  if (text.includes("USD")) return "USD";
  if (text.includes("CAD")) return "CAD";
  return "MXN";
}

function detectSku(value: string) {
  const explicit = value.match(/\b(?:SKU|CLAVE|PART|NO\.?|ITEM)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})\b/i)?.[1];
  if (explicit) return explicit.slice(0, 80);
  const generic = value.match(/\b([A-Z]{2,}[-_]?[A-Z0-9]{2,}(?:[-_/][A-Z0-9]{2,})*)\b/)?.[1];
  return generic && !["MXN", "USD", "IVA"].includes(generic.toUpperCase()) ? generic.slice(0, 80) : null;
}

function detectModel(value: string) {
  const explicit = value.match(/\b(?:MODEL|MODELO)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 ._/-]{2,})\b/i)?.[1];
  if (explicit) return normalizeWhitespace(explicit).slice(0, 80);
  const known = value.match(/\b(Latitude\s+\d{4}|iPhone\s+[A-Z0-9 ]+|iPad\s+[A-Z0-9 ]+|Zebra\s+[A-Z0-9-]+)\b/i)?.[1];
  return known ? normalizeWhitespace(known).slice(0, 80) : null;
}

function looksLikeInvoiceMetadata(description: string) {
  return /\b(factura|invoice|fecha|date|cliente|customer|vendor|rfc|direccion|address|folio)\b/i.test(description);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
