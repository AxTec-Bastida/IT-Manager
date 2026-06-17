import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ClientInputError } from "@/lib/api";
import { parseFacturaXml } from "@/lib/factura-xml";
import { validateFacturaXmlUpload } from "@/lib/uploads";

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Serie="QA" Folio="65" Fecha="2026-06-17T10:00:00" Moneda="MXN" SubTotal="1000.00" Total="1160.00">
  <cfdi:Emisor Rfc="QAV010101AA1" Nombre="QA Vendor"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="Warehouse IT QA"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="43211503" NoIdentificacion="QA-XML-001" Cantidad="1" Unidad="PIEZA" Descripcion="QA XML Smoke Asset" ValorUnitario="1000.00" Importe="1000.00"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="11111111-2222-3333-4444-555555555555"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

describe("factura XML extraction", () => {
  it("parses CFDI metadata and Conceptos into exact candidates", () => {
    const result = parseFacturaXml(sampleXml);

    expect(result.metadata).toMatchObject({
      uuid: "11111111-2222-3333-4444-555555555555",
      serie: "QA",
      folio: "65",
      moneda: "MXN",
      subtotal: 1000,
      total: 1160,
      emisorName: "QA Vendor",
      emisorRfc: "QAV010101AA1",
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      description: "QA XML Smoke Asset",
      sku: "QA-XML-001",
      quantity: 1,
      unitCost: 1000,
      totalCost: 1000,
      currency: "MXN",
      confidence: 0.98,
    });
  });

  it("handles namespace prefix variations by local name", () => {
    const result = parseFacturaXml(sampleXml.replaceAll("cfdi:", "x:").replaceAll("xmlns:cfdi", "xmlns:x").replaceAll("tfd:", "tim:").replaceAll("xmlns:tfd", "xmlns:tim"));

    expect(result.metadata.uuid).toBe("11111111-2222-3333-4444-555555555555");
    expect(result.candidates[0].description).toBe("QA XML Smoke Asset");
  });

  it("rejects invalid or unsafe XML cleanly", () => {
    expect(() => parseFacturaXml("<cfdi:Comprobante></cfdi:Comprobante>")).toThrow(ClientInputError);
    expect(() => parseFacturaXml(`<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><cfdi:Comprobante />`)).toThrow(/external entity/i);
  });

  it("validates XML upload type and unsafe file choices", () => {
    expect(validateFacturaXmlUpload({ mimeType: "application/xml", fileSize: 100, fileName: "factura.xml" }).ok).toBe(true);
    expect(validateFacturaXmlUpload({ mimeType: "", fileSize: 100, fileName: "factura.xml" }).ok).toBe(true);
    expect(validateFacturaXmlUpload({ mimeType: "application/pdf", fileSize: 100, fileName: "factura.pdf" }).ok).toBe(false);
    expect(validateFacturaXmlUpload({ mimeType: "", fileSize: 100, fileName: "factura.pdf" }).ok).toBe(false);
  });

  it("keeps XML extraction route permissioned and non-mutating until reviewed", async () => {
    const extractRoute = await fs.readFile(path.join(process.cwd(), "app", "api", "facturas", "[id]", "extract-xml-line-items", "route.ts"), "utf8");
    const createRoute = await fs.readFile(path.join(process.cwd(), "app", "api", "facturas", "[id]", "line-items", "from-candidates", "route.ts"), "utf8");

    expect(extractRoute).toContain('requirePermission("inventory.write")');
    expect(extractRoute).toContain("extractFacturaXmlCandidates");
    expect(extractRoute).not.toContain("facturaLineItem.create");
    expect(createRoute).toContain('sourceType: z.enum(["PDF_TEXT", "XML"])');
  });
});
