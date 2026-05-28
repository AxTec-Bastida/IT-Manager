import {
  AssignmentStatus,
  DeviceCategory,
  DeviceCondition,
  DeviceStatus,
  EmployeeStatus,
  MaintenanceType,
  PurchaseNoteStatus,
  StockCategory,
  StockItemType,
  StockMovementType,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  ToolLinkCategory,
} from "@prisma/client";
import { z } from "zod";
import { validateIPv4, validateIpRange } from "./ip";

const ipv4 = z.string().trim().refine((value) => validateIPv4(value).ok, {
  message: "Enter a valid IPv4 address. Each octet must be 0-255.",
});

const optionalText = z.string().trim().optional().nullable().transform((value) => value || null);
const optionalDate = z.string().optional().nullable().transform((value) => (value ? new Date(value) : null));
const optionalNumber = z.preprocess((value) => (value === "" || value == null ? null : value), z.coerce.number().nullable());
const optionalInt = z.preprocess((value) => (value === "" || value == null ? null : value), z.coerce.number().int().nullable());
const percent = optionalInt.refine((value) => value == null || (value >= 0 && value <= 100), "Enter a value from 0 to 100.");
const optionalIpv4 = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value || null)
  .refine((value) => !value || validateIPv4(value).ok, {
    message: "Enter a valid IPv4 address. Each octet must be 0-255.",
  });

export const deviceSchema = z.object({
  assetTag: optionalText,
  name: z.string().trim().min(1, "Device name is required."),
  category: z.nativeEnum(DeviceCategory),
  ipAddress: optionalIpv4,
  macAddress: optionalText,
  vlan: z.preprocess((value) => (value === "" || value == null ? null : value), z.coerce.number().int().min(1).max(4094).nullable()),
  location: optionalText,
  areaDepartment: optionalText,
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  status: z.nativeEnum(DeviceStatus),
  condition: z.nativeEnum(DeviceCondition).default("GOOD"),
  assignedTo: optionalText,
  employeeId: optionalText,
  purchaseDate: optionalDate,
  warrantyExpiresAt: optionalDate,
  repairNotes: optionalText,
  blackTonerLevel: percent,
  cyanTonerLevel: percent,
  magentaTonerLevel: percent,
  yellowTonerLevel: percent,
  drumLevel: percent,
  fuserStatus: optionalText,
  pageCount: optionalInt.refine((value) => value == null || value >= 0, "Page count must be zero or higher."),
  lastSupplyReplacementAt: optionalDate,
  lowSupplyThreshold: percent,
  lastCleanedAt: optionalDate,
  cleaningIntervalDays: optionalInt.refine((value) => value == null || value >= 1, "Cleaning interval must be at least 1 day."),
  lastPrintheadReplacementAt: optionalDate,
  lastPlatenRollerReplacementAt: optionalDate,
  lastCutterReplacementAt: optionalDate,
  estimatedPrintheadLife: optionalInt.refine((value) => value == null || value >= 0, "Estimated life must be zero or higher."),
  maintenanceDueAt: optionalDate,
  maintenanceNotes: optionalText,
  notes: optionalText,
  lastSeenAt: z.string().optional().nullable().transform((value) => (value ? new Date(value) : null)),
  facturaId: optionalText,
  isFixedAsset: z.coerce.boolean().default(false),
  usesStaticIp: z.coerce.boolean().default(false),
  expectedLocationZoneId: optionalText,
  movementAlertsEnabled: z.coerce.boolean().default(false),
  allowedZoneDistance: z.coerce.number().int().min(0).max(10).default(0),
  ipRangeId: optionalText,
});

export const facturaSchema = z.object({
  facturaNumber: z.string().trim().min(1, "Factura number is required."),
  vendorName: z.string().trim().min(1, "Vendor is required."),
  vendorRfc: optionalText,
  purchaseDate: optionalDate,
  receivedDate: optionalDate,
  poNumber: optionalText,
  totalAmount: optionalNumber.refine((value) => value == null || value >= 0, "Total amount must be zero or higher."),
  currency: optionalText.transform((value) => value || "USD"),
  warrantyStartAt: optionalDate,
  warrantyEndAt: optionalDate,
  notes: optionalText,
});

export const ipRangeSchema = z
  .object({
    name: z.string().trim().min(1, "Range name is required."),
    category: z.nativeEnum(DeviceCategory),
    vlan: z.coerce.number().int().min(1).max(4094),
    subnet: optionalText,
    startIp: ipv4,
    endIp: ipv4,
    location: optionalText,
    notes: optionalText,
    active: z.coerce.boolean().default(true),
  })
  .superRefine((value, context) => {
    const result = validateIpRange(value.startIp, value.endIp);
    if (!result.ok) {
      context.addIssue({ code: "custom", message: result.message, path: ["endIp"] });
    }
  });

export const settingsSchema = z.object({
  defaultVlan: z.coerce.number().int().min(1).max(4094),
  defaultCategory: z.nativeEnum(DeviceCategory),
  maxScanSize: z.coerce.number().int().min(1).max(512),
  pingTimeoutMs: z.coerce.number().int().min(100).max(5000),
  autoSaveScanResults: z.coerce.boolean(),
  siteName: z.string().trim().min(1),
  defaultLowStockThreshold: z.coerce.number().int().min(0).max(9999),
  defaultThermalCleaningIntervalDays: z.coerce.number().int().min(1).max(3650),
  defaultMfpLowSupplyThreshold: z.coerce.number().int().min(0).max(100),
  enablePrinterMaintenanceAlerts: z.coerce.boolean(),
  enableLowStockAlerts: z.coerce.boolean(),
  enableConflictAlerts: z.coerce.boolean(),
  enableWarrantyAlerts: z.coerce.boolean(),
  warrantyAlertThresholdDays: z.coerce.number().int().min(1).max(3650),
  enableMovementAlerts: z.coerce.boolean(),
  defaultAllowedZoneDistance: z.coerce.number().int().min(0).max(10),
  autoResolveMovementAlerts: z.coerce.boolean(),
  enableMissingAssetSeenOnlineAlerts: z.coerce.boolean(),
  alertDuplicateSuppressionEnabled: z.coerce.boolean(),
  defaultCurrency: z.string().trim().min(1).max(8),
});

export const employeeSchema = z.object({
  fullName: z.string().trim().min(1, "Employee name is required."),
  employeeId: optionalText,
  email: optionalText.refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address."),
  department: optionalText,
  title: optionalText,
  site: optionalText,
  supervisorName: optionalText,
  supervisorEmail: optionalText.refine((value) => !value || z.email().safeParse(value).success, "Enter a valid supervisor email address."),
  phoneNumber: optionalText,
  status: z.nativeEnum(EmployeeStatus).default("ACTIVE"),
  notes: optionalText,
});

export const assignmentSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required."),
  assignedBy: optionalText,
  assignmentDate: z.string().optional().nullable().transform((value) => (value ? new Date(value) : new Date())),
  signatureData: z.string().trim().min(1, "Signature is required."),
  termsAccepted: z.coerce.boolean().refine((value) => value, "Terms must be accepted."),
  termsText: optionalText,
  notes: optionalText,
  status: z.nativeEnum(AssignmentStatus).default("ACTIVE"),
  assetIds: z.array(z.string().min(1)).min(1, "Select at least one asset."),
});

export const stockItemSchema = z.object({
  name: z.string().trim().min(1, "Stock item name is required."),
  sku: optionalText,
  category: z.nativeEnum(StockCategory),
  itemType: z.nativeEnum(StockItemType),
  compatibleAssetCategory: z.nativeEnum(DeviceCategory).optional().nullable().transform((value) => value || null),
  compatibleModels: optionalText,
  quantityOnHand: z.coerce.number().int().min(0, "Quantity must be zero or higher."),
  minimumQuantity: z.coerce.number().int().min(0, "Minimum quantity must be zero or higher."),
  reorderQuantity: optionalInt.refine((value) => value == null || value >= 0, "Reorder quantity must be zero or higher."),
  unitCost: optionalNumber.refine((value) => value == null || value >= 0, "Unit cost must be zero or higher."),
  currency: optionalText.transform((value) => value || "USD"),
  vendorName: optionalText,
  storageLocation: optionalText,
  notes: optionalText,
  facturaId: optionalText,
  active: z.coerce.boolean().default(true),
});

export const stockMovementSchema = z.object({
  movementType: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().int().min(1, "Quantity must be greater than zero."),
  adjustmentTarget: optionalInt.refine((value) => value == null || value >= 0, "Adjusted quantity must be zero or higher.").optional(),
  assetId: optionalText,
  employeeId: optionalText,
  reason: optionalText,
  notes: optionalText,
  performedBy: optionalText,
  facturaId: optionalText,
});

export const maintenanceRecordSchema = z.object({
  assetId: z.string().trim().min(1, "Asset is required."),
  maintenanceType: z.nativeEnum(MaintenanceType),
  performedAt: z.string().optional().nullable().transform((value) => (value ? new Date(value) : new Date())),
  performedBy: optionalText,
  notes: optionalText,
  stockItemId: optionalText,
  quantityUsed: optionalInt.refine((value) => value == null || value >= 1, "Quantity used must be at least 1."),
  partSerialNumber: optionalText,
  previousPartInfo: optionalText,
  newPartInfo: optionalText,
  cost: optionalNumber.refine((value) => value == null || value >= 0, "Cost must be zero or higher."),
  currency: optionalText.transform((value) => value || "USD"),
  nextDueAt: optionalDate,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required."),
  description: optionalText,
  status: z.nativeEnum(TaskStatus).default("OPEN"),
  priority: z.nativeEnum(TaskPriority).default("MEDIUM"),
  dueDate: optionalDate,
  reminderDate: optionalDate,
  assignedTo: optionalText,
  category: z.nativeEnum(TaskCategory).default("GENERAL"),
  relatedDeviceId: optionalText,
  relatedEmployeeId: optionalText,
  relatedStockItemId: optionalText,
  relatedFacturaId: optionalText,
  relatedAlertId: optionalText,
  notes: optionalText,
});

export const purchaseNoteItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required."),
  quantity: optionalInt.refine((value) => value == null || value >= 1, "Quantity must be at least 1."),
  unitCost: optionalNumber.refine((value) => value == null || value >= 0, "Unit cost must be zero or higher."),
  relatedStockItemId: optionalText,
  relatedDeviceId: optionalText,
  notes: optionalText,
});

export const purchaseNoteSchema = z.object({
  poNumber: optionalText,
  title: z.string().trim().min(1, "PO tracker title is required."),
  vendorName: optionalText,
  status: z.nativeEnum(PurchaseNoteStatus).default("DRAFT"),
  priority: z.nativeEnum(TaskPriority).optional().nullable().transform((value) => value || null),
  requestedBy: optionalText,
  requestedAt: optionalDate,
  approvedAt: optionalDate,
  orderedAt: optionalDate,
  expectedDeliveryAt: optionalDate,
  receivedAt: optionalDate,
  followUpDate: optionalDate,
  estimatedAmount: optionalNumber.refine((value) => value == null || value >= 0, "Estimated amount must be zero or higher."),
  currency: optionalText.transform((value) => value || "USD"),
  relatedFacturaId: optionalText,
  notes: optionalText,
  items: z.array(purchaseNoteItemSchema).optional().default([]),
});

export const toolLinkSchema = z.object({
  name: z.string().trim().min(1, "Tool name is required."),
  url: z.string().trim().url("Enter a valid URL."),
  category: z.nativeEnum(ToolLinkCategory),
  description: optionalText,
  icon: optionalText,
  color: optionalText,
  isFavorite: z.coerce.boolean().default(false),
  requiresVpn: z.coerce.boolean().default(false),
  internalOnly: z.coerce.boolean().default(false),
  notes: optionalText.refine((value) => !value || !/password|secret|token|api key/i.test(value), "Do not store passwords, tokens, API keys, or secrets in tool notes."),
  active: z.coerce.boolean().default(true),
});

export const locationZoneSchema = z.object({
  name: z.string().trim().min(1, "Zone name is required."),
  description: optionalText,
  floorName: optionalText,
  color: optionalText,
  active: z.coerce.boolean().default(true),
  mapId: optionalText,
});

export function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
