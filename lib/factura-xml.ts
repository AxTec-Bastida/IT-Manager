import { readFile } from "node:fs/promises";
import type { Factura } from "@prisma/client";
import { ClientInputError } from "@/lib/api";
import { uploadStoragePath } from "@/lib/uploads";

export type FacturaXmlMetadata = {
  uuid: string | null;
  serie: string | null;
  folio: string | null;
  fecha: Date | null;
  moneda: string | null;
  subtotal: number | null;
  total: number | null;
  emisorName: string | null;
  emisorRfc: string | null;
  receptorName: string | null;
  receptorRfc: string | null;
};

export type FacturaXmlCandidate = {
  description: string;
  sku: string | null;
  model: string | null;
  category: null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  currency: string;
  confidence: number;
  rawTextSnippet: string;
  warnings: string[];
};

export type FacturaXmlExtractionResult = {
  status: "SUCCESS";
  metadata: FacturaXmlMetadata;
  candidates: FacturaXmlCandidate[];
  warnings: string[];
};

type XmlFactura = Pick<Factura, "xmlFilename" | "xmlPath" | "xmlMimeType" | "xmlOriginalName">;

type XmlElement = {
  tagName: string;
  localName: string;
  attributes: Record<string, string>;
  raw: string;
};

const unsafeXmlPattern = /<!DOCTYPE|<!ENTITY|SYSTEM\s+["']|PUBLIC\s+["']|<\?xml-stylesheet/i;

export function resolveFacturaXmlUploadPath(factura: XmlFactura) {
  const storedFilename = factura.xmlFilename || factura.xmlPath?.split("/").pop() || "";
  if (!storedFilename) throw new ClientInputError("Factura has no XML attachment to extract.", 422);
  return uploadStoragePath("facturas", storedFilename);
}

export async function extractFacturaXmlCandidates(factura: XmlFactura): Promise<FacturaXmlExtractionResult> {
  if (!factura.xmlFilename && !factura.xmlPath) {
    throw new ClientInputError("Factura has no XML attachment to extract.", 422);
  }
  const xml = await readFile(resolveFacturaXmlUploadPath(factura), "utf8").catch((error) => {
    throw new ClientInputError(`Could not read factura XML attachment. ${error instanceof Error ? error.message : "Unknown error."}`, 422);
  });
  return parseFacturaXml(xml);
}

export function parseFacturaXml(xml: string): FacturaXmlExtractionResult {
  const text = stripBom(xml).trim();
  if (!text) throw new ClientInputError("Factura XML file is empty.", 422);
  if (unsafeXmlPattern.test(text)) throw new ClientInputError("Factura XML contains external entity or stylesheet declarations and was rejected.", 422);

  const comprobante = findFirstElement(text, "Comprobante");
  if (!comprobante) throw new ClientInputError("Factura XML does not contain a CFDI Comprobante node.", 422);
  const emisor = findFirstElement(text, "Emisor");
  const receptor = findFirstElement(text, "Receptor");
  const timbre = findFirstElement(text, "TimbreFiscalDigital");
  const conceptos = findElements(text, "Concepto");
  if (!conceptos.length) throw new ClientInputError("Factura XML does not contain Concepto line items.", 422);

  const currency = cleanText(attribute(comprobante, "Moneda")) || "MXN";
  const metadata: FacturaXmlMetadata = {
    uuid: cleanText(attribute(timbre, "UUID")),
    serie: cleanText(attribute(comprobante, "Serie")),
    folio: cleanText(attribute(comprobante, "Folio")),
    fecha: parseXmlDate(attribute(comprobante, "Fecha")),
    moneda: currency,
    subtotal: parseXmlNumber(attribute(comprobante, "SubTotal")),
    total: parseXmlNumber(attribute(comprobante, "Total")),
    emisorName: cleanText(attribute(emisor, "Nombre")),
    emisorRfc: cleanText(attribute(emisor, "Rfc") || attribute(emisor, "RFC")),
    receptorName: cleanText(attribute(receptor, "Nombre")),
    receptorRfc: cleanText(attribute(receptor, "Rfc") || attribute(receptor, "RFC")),
  };

  const candidates = conceptos.map((concepto) => conceptoToCandidate(concepto, currency)).filter((candidate): candidate is FacturaXmlCandidate => Boolean(candidate));
  if (!candidates.length) throw new ClientInputError("Factura XML Conceptos did not contain safe line item candidates.", 422);
  return { status: "SUCCESS", metadata, candidates, warnings: [] };
}

export function facturaXmlMetadataData(metadata: FacturaXmlMetadata) {
  return {
    xmlUuid: metadata.uuid,
    xmlSerie: metadata.serie,
    xmlFolio: metadata.folio,
    xmlIssuedAt: metadata.fecha,
    xmlCurrency: metadata.moneda,
    xmlSubtotal: metadata.subtotal,
    xmlTotal: metadata.total,
    xmlEmisorName: metadata.emisorName,
    xmlEmisorRfc: metadata.emisorRfc,
  };
}

export function facturaXmlComparison(factura: Pick<Factura, "facturaNumber" | "vendorName" | "purchaseDate" | "totalAmount" | "currency">, metadata: FacturaXmlMetadata) {
  const xmlNumber = [metadata.serie, metadata.folio].filter(Boolean).join("-") || metadata.uuid || "";
  return {
    facturaNumber: { current: factura.facturaNumber, xml: xmlNumber, differs: Boolean(xmlNumber && normalizeCompare(factura.facturaNumber) !== normalizeCompare(xmlNumber)) },
    vendorName: { current: factura.vendorName, xml: metadata.emisorName ?? "", differs: Boolean(metadata.emisorName && normalizeCompare(factura.vendorName) !== normalizeCompare(metadata.emisorName)) },
    purchaseDate: { current: factura.purchaseDate?.toISOString().slice(0, 10) ?? "", xml: metadata.fecha?.toISOString().slice(0, 10) ?? "", differs: Boolean(metadata.fecha && factura.purchaseDate?.toISOString().slice(0, 10) !== metadata.fecha.toISOString().slice(0, 10)) },
    total: { current: factura.totalAmount ?? null, xml: metadata.total, differs: metadata.total != null && factura.totalAmount != null && Math.abs(factura.totalAmount - metadata.total) > 0.01 },
    currency: { current: factura.currency, xml: metadata.moneda ?? "", differs: Boolean(metadata.moneda && normalizeCompare(factura.currency) !== normalizeCompare(metadata.moneda)) },
  };
}

function conceptoToCandidate(concepto: XmlElement, currency: string): FacturaXmlCandidate | null {
  const description = cleanText(attribute(concepto, "Descripcion") || attribute(concepto, "Descripción"));
  const quantity = parseXmlNumber(attribute(concepto, "Cantidad"));
  const unitCost = parseXmlNumber(attribute(concepto, "ValorUnitario"));
  const totalCost = parseXmlNumber(attribute(concepto, "Importe"));
  if (!description || quantity == null || unitCost == null || totalCost == null) return null;
  const warnings: string[] = [];
  if (Math.abs(roundCurrency(quantity * unitCost) - totalCost) > 0.05) warnings.push("Quantity times unit cost does not match XML importe.");
  return {
    description,
    sku: cleanText(attribute(concepto, "NoIdentificacion") || attribute(concepto, "ClaveProdServ")),
    model: null,
    category: null,
    quantity: Math.max(1, Math.round(quantity)),
    unitCost,
    totalCost,
    currency,
    confidence: warnings.length ? 0.85 : 0.98,
    rawTextSnippet: [
      `Descripcion=${description}`,
      `Cantidad=${quantity}`,
      `ValorUnitario=${unitCost}`,
      `Importe=${totalCost}`,
      attribute(concepto, "NoIdentificacion") ? `NoIdentificacion=${attribute(concepto, "NoIdentificacion")}` : "",
      attribute(concepto, "ClaveProdServ") ? `ClaveProdServ=${attribute(concepto, "ClaveProdServ")}` : "",
    ].filter(Boolean).join(" | ").slice(0, 240),
    warnings,
  };
}

function findFirstElement(xml: string, localName: string) {
  return findElements(xml, localName)[0] ?? null;
}

function findElements(xml: string, localName: string) {
  const elements: XmlElement[] = [];
  const pattern = /<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\b([^<>]*?)(?:\/>|>)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const tagName = match[1];
    if (tagName.startsWith("?") || tagName.startsWith("!")) continue;
    const tagLocalName = tagName.includes(":") ? tagName.split(":").pop()! : tagName;
    if (tagLocalName.toLowerCase() !== localName.toLowerCase()) continue;
    elements.push({ tagName, localName: tagLocalName, attributes: parseAttributes(match[2]), raw: match[0] });
  }
  return elements;
}

function parseAttributes(source: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*=\s*(["'])([\s\S]*?)\2/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const rawName = match[1];
    const localName = rawName.includes(":") ? rawName.split(":").pop()! : rawName;
    attributes[localName.toLowerCase()] = decodeXmlEntities(match[3]);
  }
  return attributes;
}

function attribute(element: XmlElement | null | undefined, name: string) {
  return element?.attributes[name.toLowerCase()] ?? null;
}

function parseXmlNumber(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? roundCurrency(parsed) : null;
}

function parseXmlDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(value?: string | null) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text || null;
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeCompare(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
