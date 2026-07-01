import { describe, expect, it } from "vitest";
import {
  findDuplicateIps,
  findDuplicateMacs,
  findUnlinkedFacturas,
  canArchiveSuspiciousStock,
  detectSuspiciousAssetNames,
  detectSuspiciousStockComments,
  findPhysicalLabelAliasConflicts,
  findSledDisplayReview,
  summarizeStockVsAssetClassification,
  suggestedAssetName,
  summarizePhotoCompliance,
  summarizeAssetValueQuality,
  parseSkippedDuplicateRows,
  summarizeMissingFields,
  summarizeMobileAssets,
  summarizeStaticAssets,
  summarizeStockReview,
  summarizeDataQualityReviewForApi,
  summarizeFacturaLineItemQuality,
} from "@/lib/data-quality";

const baseDevice = {
  id: "dev-1",
  name: "Asset",
  assetTag: "TAG-1",
  serialNumber: "SER-1",
  category: "DESKTOP",
  status: "ACTIVE",
  model: "Model",
  location: "Packing",
  areaDepartment: "Packing",
  ipAddress: null,
  macAddress: null,
  usesStaticIp: false,
  isFixedAsset: false,
  movementAlertsEnabled: false,
};

describe("data quality review helpers", () => {
  it("detects duplicate IPs only for non-retired inventory", () => {
    const duplicates = findDuplicateIps([
      { ...baseDevice, id: "a", ipAddress: "192.168.163.21" },
      { ...baseDevice, id: "b", assetTag: "TAG-2", serialNumber: "SER-2", ipAddress: "192.168.163.21" },
      { ...baseDevice, id: "c", status: "RETIRED", assetTag: "TAG-3", serialNumber: "SER-3", ipAddress: "192.168.163.21" },
    ]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].count).toBe(2);
    expect(duplicates[0].ipAddress).toBe("192.168.163.21");
  });

  it("detects duplicate MACs only for non-retired inventory", () => {
    const duplicates = findDuplicateMacs([
      { ...baseDevice, id: "a", macAddress: "aa-bb-cc-dd-ee-ff" },
      { ...baseDevice, id: "b", assetTag: "TAG-2", serialNumber: "SER-2", macAddress: "AA:BB:CC:DD:EE:FF" },
      { ...baseDevice, id: "c", status: "RETIRED", assetTag: "TAG-3", serialNumber: "SER-3", macAddress: "AA:BB:CC:DD:EE:FF" },
    ]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].count).toBe(2);
    expect(duplicates[0].macAddress).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("detects unlinked facturas", () => {
    const unlinked = findUnlinkedFacturas([
      { id: "f1", facturaNumber: "F-1", vendorName: "Vendor", purchaseDate: null, receivedDate: null, notes: null, assets: [], stockItems: [] },
      { id: "f2", facturaNumber: "F-2", vendorName: "Vendor", purchaseDate: null, receivedDate: null, notes: null, assets: [{ id: "d1" }], stockItems: [] },
    ]);

    expect(unlinked.map((factura) => factura.facturaNumber)).toEqual(["F-1"]);
  });

  it("groups missing asset tag and serial review lists", () => {
    const missing = summarizeMissingFields([
      { ...baseDevice, id: "a", assetTag: null },
      { ...baseDevice, id: "b", serialNumber: null },
      { ...baseDevice, id: "c", model: null, location: null, areaDepartment: null },
      { ...baseDevice, id: "laptop-1", category: "LAPTOP", serialNumber: null, chargerIncluded: null },
      { ...baseDevice, id: "scanner-1", category: "SCANNER", serialNumber: null },
      { ...baseDevice, id: "phone-1", category: "PHONE", serialNumber: null },
      {
        ...baseDevice,
        id: "needs-review-1",
        sourceRelationships: [{ relationshipType: "IPOD_SLED_PAIR", status: "NEEDS_REVIEW", targetDeviceId: "other" }],
      },
    ]);

    expect(missing.missingAssetTag).toHaveLength(1);
    expect(missing.missingSerial).toHaveLength(4);
    expect(missing.missingModel).toHaveLength(1);
    expect(missing.missingLocation).toHaveLength(1);
    expect(missing.missingSerialRequired).toHaveLength(3);
    expect(missing.laptopMissingCharger).toHaveLength(1);
    expect(missing.relationshipNeedsReview).toHaveLength(1);
  });

  it("flags generic peripheral-like devices for stock vs asset review", () => {
    const review = summarizeStockVsAssetClassification(
      [
        { ...baseDevice, id: "mouse-device", name: "Mouse", category: "OTHER", assetTag: "GHT-T-8" },
        { ...baseDevice, id: "laptop", name: "Dell Laptop", category: "LAPTOP" },
      ],
      [
        { id: "stock-1", name: "Laptop Latitude", sku: null, category: "OTHER", itemType: "SUPPLY", quantityOnHand: 1, minimumQuantity: 0, storageLocation: null, vendorName: null, facturaId: null },
        { id: "stock-2", name: "Mouse", sku: null, category: "MOUSE", itemType: "PERIPHERAL", quantityOnHand: 1, minimumQuantity: 0, storageLocation: null, vendorName: null, facturaId: null },
      ],
    );

    expect(review.genericPeripheralDevices.map((asset) => asset.id)).toEqual(["mouse-device"]);
    expect(review.serializedLookingStock.map((item) => item.id)).toEqual(["stock-1"]);
  });

  it("flags mobile Apple network tracking violations", () => {
    const mobile = summarizeMobileAssets([
      { ...baseDevice, id: "ipod", category: "TABLET", model: "iPod (7th Gen)" },
      { ...baseDevice, id: "iphone", category: "PHONE", model: "iPhone SE", ipAddress: "192.168.1.10", usesStaticIp: true },
    ]);

    expect(mobile.iPods).toBe(1);
    expect(mobile.iPhones).toBe(1);
    expect(mobile.networkTrackingEnabled).toBe(1);
    expect(mobile.withIp).toBe(1);
    expect(mobile.violations).toHaveLength(1);
  });

  it("summarizes scale/static asset review counts", () => {
    const staticSummary = summarizeStaticAssets([
      { ...baseDevice, id: "scale-1", category: "SCALE", ipAddress: "192.168.163.50", usesStaticIp: true },
      { ...baseDevice, id: "scale-2", category: "SCALE", ipAddress: null, macAddress: null },
      { ...baseDevice, id: "printer-1", category: "THERMAL_PRINTER", ipAddress: null, location: null, areaDepartment: null },
    ]);

    expect(staticSummary.scales.total).toBe(2);
    expect(staticSummary.scales.withIp).toBe(1);
    expect(staticSummary.scales.missingIp).toHaveLength(1);
    expect(staticSummary.printers.total).toBe(1);
    expect(staticSummary.missingLocation.map((asset) => asset.id)).toEqual(["printer-1"]);
    expect(staticSummary.activeMissingLocation.map((asset) => asset.id)).toEqual(["printer-1"]);
    expect(staticSummary.staticIpMissingLocation).toHaveLength(0);
  });

  it("summarizes stock review lists", () => {
    const stock = summarizeStockReview([
      { id: "s1", name: "Battery", sku: null, category: "BATTERY", quantityOnHand: 0, minimumQuantity: 0, storageLocation: null, facturaId: null },
      { id: "s2", name: "Cable", sku: "C-1", category: "CABLE", quantityOnHand: 5, minimumQuantity: 1, storageLocation: "Cabinet", facturaId: "f1" },
    ]);

    expect(stock.total).toBe(2);
    expect(stock.quantityZero).toHaveLength(1);
    expect(stock.missingSku).toHaveLength(1);
    expect(stock.linkedToFacturas).toHaveLength(1);
  });

  it("summarizes data quality API payloads instead of returning export-sized arrays by default", () => {
    const summary = summarizeDataQualityReviewForApi(
      {
        generatedAt: "2026-06-19T00:00:00.000Z",
        duplicateIps: [
          { ipAddress: "192.168.1.10", assets: [{ id: "a" }, { id: "b" }, { id: "c" }] },
          { ipAddress: "192.168.1.11", assets: [{ id: "d" }] },
          { ipAddress: "192.168.1.12", assets: [{ id: "e" }] },
        ],
        photoCompliance: {
          missingRequired: Array.from({ length: 4 }, (_, index) => ({ id: `asset-${index}` })),
        },
      },
      2,
    ) as {
      payloadMode: string;
      previewLimit: number;
      fullDetailUrl: string;
      duplicateIps: { count: number; preview: Array<{ assets: { count: number; preview: unknown[] } }> };
      photoCompliance: { missingRequired: { count: number; preview: unknown[] } };
    };

    expect(summary.payloadMode).toBe("summary");
    expect(summary.previewLimit).toBe(2);
    expect(summary.fullDetailUrl).toBe("/api/data-quality?detail=full");
    expect(summary.duplicateIps.count).toBe(3);
    expect(summary.duplicateIps.preview).toHaveLength(2);
    expect(summary.duplicateIps.preview[0].assets.count).toBe(3);
    expect(summary.duplicateIps.preview[0].assets.preview).toHaveLength(2);
    expect(summary.photoCompliance.missingRequired.count).toBe(4);
    expect(summary.photoCompliance.missingRequired.preview).toHaveLength(2);
  });

  it("flags comment-like imported stock rows without flagging real stock", () => {
    const suspicious = detectSuspiciousStockComments([
      {
        id: "s1",
        name: "Falta crear iPhone J136",
        sku: null,
        category: "OTHER",
        quantityOnHand: 0,
        minimumQuantity: 0,
        storageLocation: null,
        vendorName: null,
        facturaId: null,
        notes: "Source: Consumibles row 12",
        active: true,
        _count: { movements: 0, maintenanceRecords: 0, stockIssues: 0, purchaseNoteItems: 0 },
        stockIssues: [],
      },
      { id: "s2", name: "Display Base", sku: null, category: "OTHER", quantityOnHand: 0, minimumQuantity: 0, storageLocation: null, vendorName: null, facturaId: null, active: true },
    ]);

    expect(suspicious).toHaveLength(1);
    expect(suspicious[0].name).toBe("Falta crear iPhone J136");
    expect(suspicious[0].source).toEqual({ sheetName: "Consumibles", rowNumber: 12 });
    expect(suspicious[0].canArchive).toBe(true);
  });

  it("does not allow suspicious stock cleanup when usage or links exist", () => {
    expect(canArchiveSuspiciousStock({
      id: "s1",
      name: "Falta crear iPhone J140",
      sku: null,
      category: "OTHER",
      quantityOnHand: 0,
      minimumQuantity: 0,
      storageLocation: null,
      vendorName: null,
      facturaId: null,
      active: true,
      _count: { movements: 1, maintenanceRecords: 0, stockIssues: 0, purchaseNoteItems: 0 },
      stockIssues: [],
    })).toBe(false);
  });

  it("flags laptop access point names and suggests brand plus model", () => {
    const flagged = detectSuspiciousAssetNames([
      { ...baseDevice, id: "lp1", name: "ACCESS POINT GHT-LP-1", assetTag: "GHT-LP-1", category: "LAPTOP", brand: "DELL", model: "Latitude 3520" },
      { ...baseDevice, id: "ap1", name: "ACCESS POINT GHT-AP-1", assetTag: "GHT-AP-1", category: "ACCESS_POINT", brand: "Ubiquiti", model: "U6-LR" },
    ]);

    expect(flagged).toHaveLength(1);
    expect(flagged[0].id).toBe("lp1");
    expect(flagged[0].suggestedName).toBe("DELL Latitude 3520");
    expect(suggestedAssetName(flagged[0])).toBe("DELL Latitude 3520");
  });

  it("detects duplicate physical label aliases across assets", () => {
    const conflicts = findPhysicalLabelAliasConflicts([
      { ...baseDevice, id: "a", aliases: [{ aliasType: "PHYSICAL_LABEL", value: "J01" }] },
      { ...baseDevice, id: "b", assetTag: "TAG-2", serialNumber: "SER-2", aliases: [{ aliasType: "SCAN_CODE", value: "j01" }] },
      { ...baseDevice, id: "c", assetTag: "TAG-3", serialNumber: "SER-3", aliases: [{ aliasType: "LEGACY_ASSET_TAG", value: "J01" }] },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].normalizedValue).toBe("J01");
    expect(conflicts[0].aliases.map((item) => item.device.id)).toEqual(["a", "b"]);
  });

  it("flags sled records that are still stored as generic Other for review", () => {
    const review = findSledDisplayReview([
      { ...baseDevice, id: "sled", name: "OTHER GHT-SLD-190", assetTag: "GHT-SLD-190", category: "OTHER", brand: "Infinite Peripherals", model: "Infinea X", notes: "Source: Sled row 2" },
      { ...baseDevice, id: "scanner", name: "OTHER GHT-SCN-1", assetTag: "GHT-SCN-1", category: "OTHER", brand: null, model: "Zebra" },
    ]);

    expect(review).toHaveLength(1);
    expect(review[0].suggestedCategoryLabel).toBe("Sled");
    expect(review[0].suggestedDisplayName).toBe("Infinite Peripherals Infinea X");
    expect(review[0].source).toEqual({ sheetName: "Sled", rowNumber: 2 });
  });

  it("summarizes missing required photos", () => {
    const complete = {
      ...baseDevice,
      id: "complete",
      category: "LAPTOP",
      photos: [{ photoType: "OVERVIEW", mimeType: "image/jpeg", thumbnailPath: "/uploads/assets/thumbs/overview.jpg", sizeBytes: 500_000 }, { photoType: "ASSET_TAG" }, { photoType: "SERIAL_LABEL" }, { photoType: "CONDITION" }],
    };
    const fixedMissing = {
      ...baseDevice,
      id: "scale",
      category: "SCALE",
      isFixedAsset: true,
      photos: [{ photoType: "OVERVIEW", mimeType: "image/jpeg", sizeBytes: 3_000_000 }, { photoType: "ASSET_TAG" }, { photoType: "CONDITION" }],
    };

    const summary = summarizePhotoCompliance([complete, fixedMissing]);
    expect(summary.missingRequired.map((asset) => asset.id)).toEqual(["scale"]);
    expect(summary.fixedMissingLocation).toHaveLength(1);
    expect(summary.fixedMissingLocation[0].checklist.missing).toContain("LOCATION_INSTALLED");
    expect(summary.photosMissingThumbnails.map((item) => item.asset.id)).toEqual(["scale"]);
    expect(summary.oversizedPhotos.map((item) => item.asset.id)).toEqual(["scale"]);
  });

  it("summarizes asset value review gaps", () => {
    const summary = summarizeAssetValueQuality([
      { ...baseDevice, id: "missing-value", valueProfile: null },
      {
        ...baseDevice,
        id: "missing-date",
        valueProfile: {
          purchaseValue: 1200,
          currency: "MXN",
          purchaseDate: null,
          usefulLifeMonths: 36,
          residualPercent: 30,
          residualValue: 360,
          currentEstimatedValue: 1200,
          lastCalculatedAt: new Date("2026-06-01"),
        },
      },
      {
        ...baseDevice,
        id: "complete",
        purchaseDate: new Date("2026-01-01"),
        valueProfile: {
          purchaseValue: 1500,
          currency: "MXN",
          purchaseDate: new Date("2026-01-01"),
          usefulLifeMonths: 36,
          residualPercent: 30,
          residualValue: 450,
          currentEstimatedValue: 1350,
          lastCalculatedAt: new Date("2026-06-01"),
        },
      },
    ], new Date("2026-06-15"));

    expect(summary.totalTracked).toBe(3);
    expect(summary.withProfile).toHaveLength(2);
    expect(summary.missingPurchaseValue.map((asset) => asset.id)).toEqual(["missing-value"]);
    expect(summary.missingPurchaseDate.map((asset) => asset.id)).toEqual(["missing-date"]);
    expect(summary.reviewRows.map((asset) => asset.id)).toEqual(["missing-value", "missing-date"]);
  });

  it("summarizes factura line item value matching review gaps", () => {
    const factura = {
      id: "factura-1",
      facturaNumber: "F-100",
      vendorName: "Dell",
      purchaseDate: new Date("2026-06-01"),
      receivedDate: null,
      notes: null,
      assets: [],
      stockItems: [],
      lineItems: [
        {
          id: "line-1",
          description: "Dell Latitude 5520",
          quantity: 2,
          unitCost: 1200,
          currency: "MXN",
          assetLinks: [{ id: "link-1", deviceId: "asset-1" }],
        },
        {
          id: "line-2",
          description: "Extra linked line",
          quantity: 1,
          unitCost: 900,
          currency: "MXN",
          assetLinks: [{ id: "link-2", deviceId: "asset-2" }, { id: "link-3", deviceId: "asset-3" }],
        },
      ],
    };

    const summary = summarizeFacturaLineItemQuality(
      [factura],
      [
        { ...baseDevice, id: "asset-1", valueProfile: null, facturaLineItemLinks: [{ id: "link-1", lineItem: { id: "line-1", description: "Dell Latitude 5520", quantity: 2, factura: { id: "factura-1", facturaNumber: "F-100", vendorName: "Dell" } } }] },
        {
          ...baseDevice,
          id: "asset-2",
          valueProfile: {
            purchaseValue: 900,
            currency: "MXN",
            purchaseDate: new Date("2026-06-01"),
            usefulLifeMonths: 36,
            residualPercent: 30,
            residualValue: 270,
            currentEstimatedValue: 900,
            lastCalculatedAt: new Date("2026-06-01"),
            sourceType: "FACTURA_LINE_ITEM",
          },
          facturaLineItemLinks: [
            { id: "link-2", lineItem: { id: "line-2", description: "Extra linked line", quantity: 1, factura: { id: "factura-1", facturaNumber: "F-100", vendorName: "Dell" } } },
            { id: "link-extra", lineItem: { id: "line-extra", description: "Another line", quantity: 1, factura: { id: "factura-1", facturaNumber: "F-100", vendorName: "Dell" } } },
          ],
        },
      ],
    );

    expect(summary.totalLineItems).toBe(2);
    expect(summary.facturasWithNoLineItems).toHaveLength(0);
    expect(summary.lineItemsWithUnlinkedQuantity.map((item) => item.id)).toEqual(["line-1"]);
    expect(summary.lineItemsOverLinked.map((item) => item.id)).toEqual(["line-2"]);
    expect(summary.linkedAssetsMissingValue.map((asset) => asset.id)).toEqual(["asset-1"]);
    expect(summary.assetsLinkedToMultipleLineItems.map((asset) => asset.id)).toEqual(["asset-2"]);
  });

  it("flags factura attachments needing extraction or manual line item entry", () => {
    const summary = summarizeFacturaLineItemQuality(
      [
        {
          id: "factura-attachment",
          facturaNumber: "QA-PDF-1",
          vendorName: "QA Vendor",
          purchaseDate: null,
          receivedDate: null,
          notes: null,
          originalFilename: "qa.pdf",
          filePath: "/uploads/facturas/qa.pdf",
          assets: [],
          stockItems: [],
          lineItems: [],
          extractionAttempts: [],
        },
        {
          id: "factura-no-text",
          facturaNumber: "QA-PDF-2",
          vendorName: "QA Vendor",
          purchaseDate: null,
          receivedDate: null,
          notes: null,
          originalFilename: "scan.pdf",
          filePath: "/uploads/facturas/scan.pdf",
          assets: [],
          stockItems: [],
          lineItems: [],
          extractionAttempts: [{ id: "attempt-1", status: "NO_TEXT", candidateCount: 0, createdLineItemCount: 0, warningsJson: "[]", createdAt: new Date("2026-06-17") }],
        },
        {
          id: "factura-xml",
          facturaNumber: "QA-XML-1",
          vendorName: "QA Vendor",
          purchaseDate: null,
          receivedDate: null,
          notes: null,
          xmlPath: "/uploads/facturas/qa.xml",
          xmlOriginalName: "qa.xml",
          xmlUuid: "uuid-1",
          xmlTotal: 1160,
          assets: [],
          stockItems: [],
          lineItems: [],
          extractionAttempts: [{ id: "attempt-xml", status: "XML_SUCCESS", candidateCount: 1, createdLineItemCount: 0, warningsJson: "[]", createdAt: new Date("2026-06-17") }],
        },
        {
          id: "factura-xml-mismatch",
          facturaNumber: "QA-XML-2",
          vendorName: "QA Vendor",
          purchaseDate: null,
          receivedDate: null,
          notes: null,
          xmlPath: "/uploads/facturas/qa2.xml",
          xmlOriginalName: "qa2.xml",
          xmlTotal: 1160,
          assets: [],
          stockItems: [],
          lineItems: [{ id: "line-xml", description: "QA XML Asset", quantity: 1, unitCost: 1000, currency: "MXN", assetLinks: [] }],
          extractionAttempts: [],
        },
      ],
      [],
    );

    expect(summary.facturasWithAttachmentNoLineItems.map((factura) => factura.facturaNumber)).toEqual(["QA-PDF-1", "QA-PDF-2", "QA-XML-1"]);
    expect(summary.facturasWithXmlNoLineItems.map((factura) => factura.facturaNumber)).toEqual(["QA-XML-1"]);
    expect(summary.extractionAttemptedNoLineItems.map((factura) => factura.facturaNumber)).toEqual(["QA-PDF-2", "QA-XML-1"]);
    expect(summary.xmlExtractionAttemptedNoLineItems.map((factura) => factura.facturaNumber)).toEqual(["QA-XML-1"]);
    expect(summary.noTextExtractionAttempts.map((factura) => factura.facturaNumber)).toEqual(["QA-PDF-2"]);
    expect(summary.xmlTotalMismatches.map((factura) => factura.facturaNumber)).toEqual(["QA-XML-2"]);
  });

  it("parses skipped duplicate workbook row audit messages", () => {
    const rows = parseSkippedDuplicateRows([
      {
        sheetName: "Zebra Scanner",
        rowNumber: 42,
        errorType: "WARNING",
        message: "Duplicate assetTag inside workbook; first seen at Zebra Scanner row 20. This duplicate row will be skipped during import.",
        rawJson: JSON.stringify({ "New ID": "GHT-SCN-1", "S/N": "SER-2" }),
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].duplicateType).toBe("assetTag");
    expect(rows[0].duplicateKey).toBe("GHT-SCN-1");
    expect(rows[0].firstSeenAt).toBe("Zebra Scanner row 20");
  });
});
