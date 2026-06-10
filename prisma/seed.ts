import { PrismaClient, type DeviceCategory, type DeviceStatus, type DeviceCondition } from "@prisma/client";
import { assertDestructiveSeedAllowed } from "../lib/seed-safety";

assertDestructiveSeedAllowed();

const prisma = new PrismaClient();

const ranges = [
  {
    name: "Warehouse Thermal Printers",
    category: "THERMAL_PRINTER" as DeviceCategory,
    vlan: 163,
    subnet: "192.168.163.0/24",
    startIp: "192.168.163.20",
    endIp: "192.168.163.79",
    location: "Warehouse floor",
    notes: "Zebra and label printers reserved for packing, shipping, and returns.",
  },
  {
    name: "Scales and Pack Stations",
    category: "SCALE" as DeviceCategory,
    vlan: 164,
    subnet: "192.168.164.0/24",
    startIp: "192.168.164.20",
    endIp: "192.168.164.60",
    location: "Pack lanes",
    notes: "Static IP scales at outbound pack stations.",
  },
  {
    name: "Office Phones and MFPs",
    category: "PHONE" as DeviceCategory,
    vlan: 120,
    subnet: "192.168.120.0/24",
    startIp: "192.168.120.50",
    endIp: "192.168.120.140",
    location: "Admin office and break room",
    notes: "Phones plus shared office devices.",
  },
  {
    name: "Mobile Scanners",
    category: "SCANNER" as DeviceCategory,
    vlan: 130,
    subnet: "192.168.130.0/24",
    startIp: "192.168.130.30",
    endIp: "192.168.130.120",
    location: "Warehouse handheld fleet",
    notes: "Cradles, scanner carts, and mobile computer reservations.",
  },
];

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.purchaseNoteItem.deleteMany();
  await prisma.purchaseNote.deleteMany();
  await prisma.task.deleteMany();
  await prisma.toolLink.deleteMany();
  await prisma.jobRun.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.assetPhoto.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.conflict.deleteMany();
  await prisma.assignmentItem.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.unifiClientSnapshot.deleteMany();
  await prisma.assetLocationHistory.deleteMany();
  await prisma.accessPointMapLocation.deleteMany();
  await prisma.locationZone.deleteMany();
  await prisma.warehouseMap.deleteMany();
  await prisma.scanResult.deleteMany();
  await prisma.scanRun.deleteMany();
  await prisma.device.deleteMany();
  await prisma.factura.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.ipRange.deleteMany();
  await prisma.appSettings.deleteMany();

  await prisma.appSettings.create({
    data: {
      id: "default",
      defaultVlan: 163,
      defaultCategory: "THERMAL_PRINTER",
      maxScanSize: 64,
      pingTimeoutMs: 800,
      autoSaveScanResults: true,
      siteName: "Warehouse IPAM",
      defaultLowStockThreshold: 2,
      defaultThermalCleaningIntervalDays: 30,
      defaultMfpLowSupplyThreshold: 20,
      enablePrinterMaintenanceAlerts: true,
      enableLowStockAlerts: true,
      alertDuplicateSuppressionEnabled: true,
      defaultCurrency: "USD",
    },
  });

  await prisma.toolLink.createMany({
    data: [
      { name: "UniFi Network", url: "https://unifi.local", category: "NETWORK", description: "Normal web link to the UniFi Network console. No API integration.", isFavorite: true, requiresVpn: true, internalOnly: true },
      { name: "GLPI", url: "https://glpi.example.local", category: "INVENTORY", description: "IT asset and support reference portal.", isFavorite: true, requiresVpn: true, internalOnly: true },
      { name: "Google Admin", url: "https://admin.google.com", category: "GOOGLE_ADMIN", description: "Google Workspace administration." },
      { name: "Microsoft MyApps", url: "https://myapps.microsoft.com", category: "MICROSOFT", description: "User app launcher and access portal.", isFavorite: true },
      { name: "Microsoft Admin", url: "https://admin.microsoft.com", category: "MICROSOFT", description: "Microsoft 365 administration." },
      { name: "Printer Management Portal", url: "https://printers.example.local", category: "PRINTERS", description: "Internal printer management portal.", requiresVpn: true, internalOnly: true },
      { name: "Camera / NVR Portal", url: "https://cameras.example.local", category: "SECURITY_CAMERAS", description: "Security camera portal link.", requiresVpn: true, internalOnly: true },
      { name: "Zebra Support", url: "https://www.zebra.com/us/en/support-downloads.html", category: "VENDORS", description: "Zebra manuals, drivers, and support downloads." },
      { name: "Internal SOP Folder", url: "https://drive.google.com", category: "DOCUMENTS_SOPS", description: "Shared IT documentation and warehouse SOP folder." },
      { name: "RMA / Warranty Portal", url: "https://support.example.com", category: "RMA_WARRANTY", description: "Vendor warranty and RMA portal link." },
    ],
  });

  const now = new Date();
  for (const job of [
    { name: "Alert refresh", type: "ALERT_REFRESH" as const, intervalMinutes: 15 },
    { name: "IPAM conflict detection", type: "CONFLICT_DETECTION" as const, intervalMinutes: 15 },
    { name: "Stock alert check", type: "STOCK_ALERT_CHECK" as const, intervalMinutes: 60 },
    { name: "Printer maintenance check", type: "PRINTER_MAINTENANCE_CHECK" as const, intervalMinutes: 60 },
    { name: "Warranty check", type: "WARRANTY_ALERT_CHECK" as const, intervalMinutes: 1440 },
    { name: "Movement alert check (legacy AP sync disabled)", type: "MOVEMENT_ALERT_CHECK_EXISTING_DATA_ONLY" as const, intervalMinutes: 30, enabled: false },
  ]) {
    await prisma.scheduledJob.create({
      data: {
        ...job,
        enabled: "enabled" in job ? job.enabled : true,
        nextRunAt: new Date(now.getTime() + job.intervalMinutes * 60 * 1000),
      },
    });
  }

  const createdRanges = new Map<string, string>();
  for (const range of ranges) {
    const created = await prisma.ipRange.create({ data: range });
    createdRanges.set(range.name, created.id);
  }

  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        fullName: "Alex Rivera",
        employeeId: "WH-1001",
        email: "alex.rivera@example.local",
        department: "Outbound",
        title: "Warehouse Supervisor",
        site: "Main Warehouse",
        supervisorName: "Jordan Lee",
        supervisorEmail: "jordan.lee@example.local",
      },
    }),
    prisma.employee.create({
      data: {
        fullName: "Taylor Chen",
        employeeId: "WH-1002",
        email: "taylor.chen@example.local",
        department: "Receiving",
        title: "Receiving Lead",
        site: "Main Warehouse",
      },
    }),
  ]);

  const warehouseMap = await prisma.warehouseMap.create({
    data: {
      name: "Main Warehouse Floor",
      imageUrl: "/warehouse-map.svg",
      floorName: "Floor 1",
      notes: "Sample configurable map. Replace with a real floor image in /public.",
      active: true,
    },
  });

  const zones = new Map<string, string>();
  for (const zone of [
    { name: "Receiving", description: "Receiving dock and inbound staging.", floorName: "Floor 1", color: "#2563eb", mapId: warehouseMap.id },
    { name: "Packing", description: "Pack lanes and print stations.", floorName: "Floor 1", color: "#16a34a", mapId: warehouseMap.id },
    { name: "Shipping", description: "Shipping doors and outbound staging.", floorName: "Floor 1", color: "#dc2626", mapId: warehouseMap.id },
    { name: "Returns", description: "Returns processing area.", floorName: "Floor 1", color: "#9333ea", mapId: warehouseMap.id },
  ]) {
    const created = await prisma.locationZone.create({ data: zone });
    zones.set(zone.name, created.id);
  }

  const apLocations = [];
  for (const apLocation of [
      {
        apName: "U6-Pro-Receiving",
        apMac: "AA:BB:CC:00:00:01",
        unifiDeviceId: "unifi-ap-receiving",
        locationLabel: "Receiving Dock",
        floorName: "Floor 1",
        mapName: "Main Warehouse Floor",
        x: 17,
        y: 28,
        mapId: warehouseMap.id,
        locationZoneId: zones.get("Receiving"),
        notes: "Approximate AP marker for receiving.",
      },
      {
        apName: "U6-Pro-Pack",
        apMac: "AA:BB:CC:00:00:02",
        unifiDeviceId: "unifi-ap-pack",
        locationLabel: "Packing Lanes",
        floorName: "Floor 1",
        mapName: "Main Warehouse Floor",
        x: 78,
        y: 28,
        mapId: warehouseMap.id,
        locationZoneId: zones.get("Packing"),
      },
      {
        apName: "U6-Pro-Shipping",
        apMac: "AA:BB:CC:00:00:03",
        unifiDeviceId: "unifi-ap-shipping",
        locationLabel: "Shipping Doors",
        floorName: "Floor 1",
        mapName: "Main Warehouse Floor",
        x: 82,
        y: 72,
        mapId: warehouseMap.id,
        locationZoneId: zones.get("Shipping"),
      },
      {
        apName: "U6-Pro-Returns",
        apMac: "AA:BB:CC:00:00:04",
        unifiDeviceId: "unifi-ap-returns",
        locationLabel: "Returns Area",
        floorName: "Floor 1",
        mapName: "Main Warehouse Floor",
        x: 56,
        y: 70,
        mapId: warehouseMap.id,
        locationZoneId: zones.get("Returns"),
      },
    ]) {
    apLocations.push(await prisma.accessPointMapLocation.create({ data: apLocation }));
  }

  const devices: Array<{
    name: string;
    category: DeviceCategory;
    ipAddress: string;
    macAddress?: string;
    vlan: number;
    location: string;
    brand: string;
    model: string;
    serialNumber?: string;
    assetTag?: string;
    status: DeviceStatus;
    condition?: DeviceCondition;
    assignedTo?: string;
    employeeId?: string;
    blackTonerLevel?: number;
    cyanTonerLevel?: number;
    magentaTonerLevel?: number;
    yellowTonerLevel?: number;
    drumLevel?: number;
    pageCount?: number;
    lowSupplyThreshold?: number;
    lastCleanedAt?: Date;
    cleaningIntervalDays?: number;
    maintenanceDueAt?: Date;
    isFixedAsset?: boolean;
    usesStaticIp?: boolean;
    expectedLocationZoneId?: string;
    movementAlertsEnabled?: boolean;
    allowedZoneDistance?: number;
    notes?: string;
    lastSeenAt?: Date;
    ipRangeId?: string;
  }> = [
    {
      name: "PACK-ZT410-01",
      assetTag: "IT-PRN-0001",
      category: "THERMAL_PRINTER",
      ipAddress: "192.168.163.20",
      macAddress: "00:11:22:33:44:20",
      vlan: 163,
      location: "Pack lane 1",
      brand: "Zebra",
      model: "ZT410",
      serialNumber: "ZT410-PACK-001",
      status: "ACTIVE",
      assignedTo: "Outbound",
      employeeId: employees[0].id,
      lastCleanedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
      cleaningIntervalDays: 30,
      maintenanceDueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      isFixedAsset: true,
      usesStaticIp: true,
      movementAlertsEnabled: true,
      expectedLocationZoneId: zones.get("Packing"),
      lastSeenAt: new Date(),
      ipRangeId: createdRanges.get("Warehouse Thermal Printers"),
    },
    {
      name: "PACK-ZT410-02",
      assetTag: "IT-PRN-0002",
      category: "THERMAL_PRINTER",
      ipAddress: "192.168.163.21",
      macAddress: "00:11:22:33:44:21",
      vlan: 163,
      location: "Pack lane 2",
      brand: "Zebra",
      model: "ZT410",
      serialNumber: "ZT410-PACK-002",
      status: "ACTIVE",
      assignedTo: "Outbound",
      lastSeenAt: new Date(Date.now() - 1000 * 60 * 30),
      ipRangeId: createdRanges.get("Warehouse Thermal Printers"),
    },
    {
      name: "SHIP-GK420D-01",
      assetTag: "IT-PRN-0003",
      category: "THERMAL_PRINTER",
      ipAddress: "192.168.163.21",
      macAddress: "00:11:22:33:44:31",
      vlan: 163,
      location: "Shipping desk",
      brand: "Zebra",
      model: "GK420d",
      serialNumber: "GK-SHIP-001",
      status: "RESERVED",
      assignedTo: "Shipping",
      notes: "Intentional duplicate IP for conflict testing.",
      ipRangeId: createdRanges.get("Warehouse Thermal Printers"),
    },
    {
      name: "PACK-SCALE-01",
      assetTag: "IT-SCL-0001",
      category: "SCALE",
      ipAddress: "192.168.164.20",
      macAddress: "00:AA:BB:CC:DD:20",
      vlan: 164,
      location: "Pack lane 1",
      brand: "Mettler Toledo",
      model: "ICS425",
      serialNumber: "MT-SCALE-001",
      status: "ACTIVE",
      assignedTo: "Outbound",
      lastSeenAt: new Date(Date.now() - 1000 * 60 * 5),
      ipRangeId: createdRanges.get("Scales and Pack Stations"),
    },
    {
      name: "PACK-SCALE-02",
      assetTag: "IT-SCL-0002",
      category: "SCALE",
      ipAddress: "192.168.164.21",
      macAddress: "00:AA:BB:CC:DD:20",
      vlan: 164,
      location: "Pack lane 2",
      brand: "Mettler Toledo",
      model: "ICS425",
      serialNumber: "MT-SCALE-002",
      status: "ACTIVE",
      assignedTo: "Outbound",
      notes: "Intentional duplicate MAC for conflict testing.",
      ipRangeId: createdRanges.get("Scales and Pack Stations"),
    },
    {
      name: "ADMIN-MFP-01",
      assetTag: "IT-MFP-0001",
      category: "MFP_PRINTER",
      ipAddress: "192.168.120.80",
      macAddress: "00:DE:AD:BE:EF:80",
      vlan: 120,
      location: "Admin office",
      brand: "Canon",
      model: "imageRUNNER",
      serialNumber: "CANON-001",
      status: "ACTIVE",
      assignedTo: "Admin",
      isFixedAsset: true,
      usesStaticIp: true,
      blackTonerLevel: 12,
      cyanTonerLevel: 44,
      magentaTonerLevel: 18,
      yellowTonerLevel: 67,
      drumLevel: 8,
      pageCount: 42880,
      lowSupplyThreshold: 20,
      ipRangeId: createdRanges.get("Office Phones and MFPs"),
    },
    {
      name: "BREAK-PHONE-01",
      assetTag: "IT-PHN-0001",
      category: "PHONE",
      ipAddress: "192.168.120.51",
      macAddress: "00:90:7A:12:34:51",
      vlan: 120,
      location: "Break room",
      brand: "Yealink",
      model: "T46S",
      status: "ACTIVE",
      assignedTo: "Facilities",
      ipRangeId: createdRanges.get("Office Phones and MFPs"),
    },
    {
      name: "SCAN-CART-01",
      assetTag: "IT-SCN-0001",
      category: "SCANNER",
      ipAddress: "192.168.130.30",
      macAddress: "84:24:8D:10:20:30",
      vlan: 130,
      location: "Receiving cart",
      brand: "Zebra",
      model: "TC52",
      serialNumber: "TC52-001",
      status: "RESERVED",
      assignedTo: "Receiving",
      employeeId: employees[1].id,
      ipRangeId: createdRanges.get("Mobile Scanners"),
    },
    {
      name: "CAM-NVR-01",
      assetTag: "IT-NVR-0001",
      category: "CAMERA_NVR",
      ipAddress: "192.168.150.10",
      macAddress: "10:22:33:44:55:66",
      vlan: 150,
      location: "MDF",
      brand: "UniFi",
      model: "UNVR",
      status: "ACTIVE",
      assignedTo: "Security",
      isFixedAsset: true,
      usesStaticIp: true,
      notes: "No matching range yet; useful reminder for future pool setup.",
    },
    {
      name: "PACK-ZT410-01",
      assetTag: "IT-PRN-0099",
      category: "THERMAL_PRINTER",
      ipAddress: "192.168.163.85",
      macAddress: "00:11:22:33:44:85",
      vlan: 164,
      location: "Returns",
      brand: "Zebra",
      model: "ZT410",
      status: "ACTIVE",
      assignedTo: "Returns",
      notes: "Intentional duplicate name plus outside range/VLAN mismatch.",
      ipRangeId: createdRanges.get("Warehouse Thermal Printers"),
    },
  ];

  for (const device of devices) {
    await prisma.device.create({ data: device });
  }

  const stockItems = await Promise.all([
    prisma.stockItem.create({
      data: {
        name: "Zebra ZT411 Printhead",
        sku: "PRT-ZT411-PH",
        category: "PRINTER_PART",
        itemType: "SPARE_PART",
        compatibleAssetCategory: "THERMAL_PRINTER",
        compatibleModels: "ZT410, ZT411",
        quantityOnHand: 1,
        minimumQuantity: 2,
        reorderQuantity: 3,
        unitCost: 425,
        currency: "USD",
        vendorName: "Zebra Parts",
        storageLocation: "IT cage shelf B2",
        notes: "Low stock sample for alert testing.",
      },
    }),
    prisma.stockItem.create({
      data: {
        name: "4x6 Thermal Labels",
        sku: "LBL-4X6-ROLL",
        category: "THERMAL_LABEL",
        itemType: "SUPPLY",
        compatibleAssetCategory: "THERMAL_PRINTER",
        compatibleModels: "ZT410, ZT411, GK420d",
        quantityOnHand: 18,
        minimumQuantity: 6,
        storageLocation: "Shipping supplies rack",
        vendorName: "Warehouse Supplies",
      },
    }),
    prisma.stockItem.create({
      data: {
        name: "USB Keyboard",
        sku: "PER-KBD-USB",
        category: "KEYBOARD",
        itemType: "PERIPHERAL",
        quantityOnHand: 9,
        minimumQuantity: 3,
        storageLocation: "IT cage shelf A1",
      },
    }),
    prisma.stockItem.create({
      data: {
        name: "Canon Black Toner",
        sku: "TONER-CANON-BLK",
        category: "TONER",
        itemType: "SUPPLY",
        compatibleAssetCategory: "MFP_PRINTER",
        compatibleModels: "imageRUNNER",
        quantityOnHand: 2,
        minimumQuantity: 2,
        storageLocation: "Admin supply cabinet",
      },
    }),
  ]);

  const assignedPrinter = await prisma.device.findFirstOrThrow({ where: { assetTag: "IT-PRN-0001" } });
  const printhead = stockItems.find((item) => item.sku === "PRT-ZT411-PH")!;
  const sampleFactura = await prisma.factura.create({
    data: {
      facturaNumber: "FAC-SEED-1001",
      vendorName: "Zebra Warehouse Supplies",
      vendorRfc: "ZWS010101ABC",
      purchaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
      receivedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 85),
      poNumber: "PO-SEED-4432",
      totalAmount: 1850.75,
      currency: "USD",
      warrantyStartAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 85),
      warrantyEndAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 280),
      notes: "Seeded purchase record for printers and spare parts.",
    },
  });
  await prisma.device.update({ where: { id: assignedPrinter.id }, data: { facturaId: sampleFactura.id, purchaseDate: sampleFactura.purchaseDate, warrantyExpiresAt: sampleFactura.warrantyEndAt } });
  await prisma.stockItem.update({ where: { id: printhead.id }, data: { facturaId: sampleFactura.id } });
  await prisma.maintenanceRecord.create({
    data: {
      assetId: assignedPrinter.id,
      maintenanceType: "CLEANING",
      performedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
      performedBy: "Seed Technician",
      notes: "Seeded cleaning history. Printer is intentionally due again.",
      nextDueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    },
  });
  await prisma.stockMovement.create({
    data: {
      stockItemId: printhead.id,
      assetId: assignedPrinter.id,
      movementType: "USED_FOR_REPAIR",
      quantity: 1,
      previousQuantity: 2,
      newQuantity: 1,
      reason: "PRINTHEAD_REPLACEMENT",
      notes: "Seeded sample part usage.",
      performedBy: "Seed Technician",
      facturaId: sampleFactura.id,
    },
  });
  const assignment = await prisma.assignment.create({
    data: {
      assignmentNumber: "ASN-SEED-0001",
      employeeId: employees[0].id,
      assignedBy: "Seed Data",
      signatureData: "data:image/png;base64,seed-signature-placeholder",
      termsAccepted: true,
      termsText: "Seeded assignment responsibility terms.",
      status: "ACTIVE",
      items: {
        create: {
          assetId: assignedPrinter.id,
          assignedCondition: "GOOD",
        },
      },
    },
  });
  await prisma.device.update({
    where: { id: assignedPrinter.id },
    data: { status: "IN_USE_ASSIGNED", employeeId: employees[0].id, assignedTo: employees[0].fullName },
  });

  const scannerAsset = await prisma.device.findFirstOrThrow({ where: { name: "SCAN-CART-01" } });
  await prisma.device.update({ where: { id: scannerAsset.id }, data: { status: "MISSING" } });
  const receivingAp = apLocations.find((ap) => ap.apName === "U6-Pro-Receiving")!;
  const packAp = apLocations.find((ap) => ap.apName === "U6-Pro-Pack")!;
  const shippingAp = apLocations.find((ap) => ap.apName === "U6-Pro-Shipping")!;
  const historySeenAts = [
    new Date(Date.now() - 1000 * 60 * 60 * 6),
    new Date(Date.now() - 1000 * 60 * 60 * 3),
    new Date(Date.now() - 1000 * 60 * 45),
  ];
  for (const [index, ap] of [receivingAp, packAp, shippingAp].entries()) {
    await prisma.assetLocationHistory.create({
      data: {
        assetId: scannerAsset.id,
        source: "UNIFI",
        apName: ap.apName,
        apMac: ap.apMac,
        locationLabel: ap.locationLabel,
        x: ap.x,
        y: ap.y,
        ipAddress: scannerAsset.ipAddress,
        signalStrength: -54 - index * 6,
        seenAt: historySeenAts[index],
        syncedAt: historySeenAts[index],
        notes: "Seeded AP-based sample location.",
        apMapLocationId: ap.id,
      },
    });
  }
  await prisma.unifiClientSnapshot.create({
    data: {
      assetId: scannerAsset.id,
      clientMac: scannerAsset.macAddress ?? "UNKNOWN",
      ipAddress: scannerAsset.ipAddress,
      hostname: scannerAsset.name,
      apName: shippingAp.apName,
      apMac: shippingAp.apMac,
      unifiApId: shippingAp.unifiDeviceId,
      online: true,
      signalStrength: -66,
      lastSeenAt: historySeenAts[2],
      syncedAt: new Date(),
      raw: JSON.stringify({ seeded: true, readOnly: true }),
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        action: "seed.completed",
        entity: "system",
        message: "Seeded sample warehouse ranges, employees, inventory, assignments, and intentional conflicts.",
      },
      {
        action: "assignment.created",
        entity: "assignment",
        entityId: assignment.id,
        message: "Created seeded sample assignment ASN-SEED-0001.",
      },
      {
        action: "device.created",
        entity: "device",
        message: "Created initial sample devices.",
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
