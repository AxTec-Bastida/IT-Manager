import type {
  AlertSeverity,
  AlertSource,
  AlertStatus,
  AlertType,
  AssetPhotoType,
  AssignmentStatus,
  DeviceCategory,
  DeviceCondition,
  DeviceStatus,
  EmployeeStatus,
  MaintenanceType,
  JobRunStatus,
  ScheduledJobLastStatus,
  ScheduledJobType,
  StockCategory,
  StockItemType,
  StockMovementType,
} from "@prisma/client";

export const categoryLabels: Record<DeviceCategory, string> = {
  THERMAL_PRINTER: "Thermal Printers",
  MFP_PRINTER: "MFP Printers",
  OTHER_PRINTER: "Other Printers",
  SCALE: "Scales",
  PHONE: "Phones",
  SCANNER: "Zebra / Scanners",
  LAPTOP: "Laptops",
  DESKTOP: "Desktops",
  MONITOR: "Monitors",
  ACCESS_POINT: "Access Points",
  SWITCH: "Switches",
  CAMERA: "Cameras",
  NVR: "NVRs",
  DOCKING_STATION: "Docking Stations",
  TABLET: "Tablets",
  CAMERA_NVR: "Cameras / NVR",
  OTHER: "Other",
};

export const categoryOptions = Object.keys(categoryLabels) as DeviceCategory[];

export const statusLabels: Record<DeviceStatus, string> = {
  ACTIVE: "Active",
  RESERVED: "Reserved",
  AVAILABLE: "Available",
  IN_USE_ASSIGNED: "In Use / Assigned",
  LOANED_OUT: "Loaned Out",
  IN_REPAIR_RMA: "In Repair/RMA",
  RETIRED: "Retired",
  MISSING: "Missing",
  LOST: "Lost",
  DISPOSED: "Disposed",
};

export const statusOptions = Object.keys(statusLabels) as DeviceStatus[];

export const activeInventoryStatuses: DeviceStatus[] = ["ACTIVE", "RESERVED", "IN_USE_ASSIGNED", "LOANED_OUT"];

export const statusTone: Record<DeviceStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  RESERVED: "bg-blue-100 text-blue-800 ring-blue-200",
  AVAILABLE: "bg-slate-100 text-slate-700 ring-slate-200",
  IN_USE_ASSIGNED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  LOANED_OUT: "bg-violet-100 text-violet-800 ring-violet-200",
  IN_REPAIR_RMA: "bg-amber-100 text-amber-900 ring-amber-200",
  RETIRED: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  MISSING: "bg-rose-100 text-rose-800 ring-rose-200",
  LOST: "bg-red-100 text-red-800 ring-red-200",
  DISPOSED: "bg-stone-200 text-stone-700 ring-stone-300",
};

export const conditionLabels: Record<DeviceCondition, string> = {
  NEW: "New",
  GOOD: "Good",
  FAIR: "Fair",
  DAMAGED: "Damaged",
  NOT_WORKING: "Not Working",
  NEEDS_REVIEW: "Needs Review",
  MISSING_ACCESSORIES: "Missing Accessories",
};

export const conditionOptions = Object.keys(conditionLabels) as DeviceCondition[];

export const conditionTone: Record<DeviceCondition, string> = {
  NEW: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  GOOD: "bg-green-100 text-green-800 ring-green-200",
  FAIR: "bg-sky-100 text-sky-800 ring-sky-200",
  DAMAGED: "bg-orange-100 text-orange-900 ring-orange-200",
  NOT_WORKING: "bg-rose-100 text-rose-800 ring-rose-200",
  NEEDS_REVIEW: "bg-amber-100 text-amber-900 ring-amber-200",
  MISSING_ACCESSORIES: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
};

export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  ACTIVE: "Active",
  RETURNED: "Returned",
  PARTIALLY_RETURNED: "Partially Returned",
  CANCELLED: "Cancelled",
};

export const assignableStatuses: DeviceStatus[] = ["AVAILABLE", "ACTIVE", "RESERVED"];

export const severityTone = {
  LOW: "bg-sky-100 text-sky-800 ring-sky-200",
  MEDIUM: "bg-amber-100 text-amber-900 ring-amber-200",
  HIGH: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const stockItemTypeLabels: Record<StockItemType, string> = {
  CONSUMABLE: "Consumable",
  PERIPHERAL: "Peripheral",
  SPARE_PART: "Spare Part",
  SUPPLY: "Supply",
};

export const stockItemTypeOptions = Object.keys(stockItemTypeLabels) as StockItemType[];

export const stockCategoryLabels: Record<StockCategory, string> = {
  KEYBOARD: "Keyboard",
  MOUSE: "Mouse",
  HEADSET: "Headset",
  CABLE: "Cable",
  ADAPTER: "Adapter",
  TONER: "Toner",
  INK: "Ink",
  THERMAL_LABEL: "Thermal Label",
  RIBBON: "Ribbon",
  BATTERY: "Battery",
  PRINTER_PART: "Printer Part",
  MAINTENANCE_KIT: "Maintenance Kit",
  OTHER: "Other",
};

export const stockCategoryOptions = Object.keys(stockCategoryLabels) as StockCategory[];

export const stockMovementTypeLabels: Record<StockMovementType, string> = {
  ADD: "Add Stock",
  REMOVE: "Remove Stock",
  ADJUST: "Adjust Count",
  USED_FOR_REPAIR: "Used for Repair",
  HANDED_OUT: "Handed Out",
  RETURNED_TO_STOCK: "Returned to Stock",
};

export const stockMovementTypeOptions = Object.keys(stockMovementTypeLabels) as StockMovementType[];

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  CLEANING: "Cleaning",
  PREVENTIVE_MAINTENANCE: "Preventive Maintenance",
  TONER_REPLACEMENT: "Toner Replacement",
  INK_REPLACEMENT: "Ink Replacement",
  DRUM_REPLACEMENT: "Drum Replacement",
  FUSER_REPLACEMENT: "Fuser Replacement",
  PRINTHEAD_REPLACEMENT: "Printhead Replacement",
  PLATEN_ROLLER_REPLACEMENT: "Platen Roller Replacement",
  CUTTER_REPLACEMENT: "Cutter Replacement",
  POWER_SUPPLY_REPLACEMENT: "Power Supply Replacement",
  REPAIR: "Repair",
  INSPECTION: "Inspection",
  OTHER: "Other",
};

export const maintenanceTypeOptions = Object.keys(maintenanceTypeLabels) as MaintenanceType[];

export const alertTypeLabels: Record<AlertType, string> = {
  LOW_STOCK: "Low Stock",
  MFP_LOW_TONER: "MFP Low Toner",
  MFP_LOW_INK: "MFP Low Ink",
  MFP_DRUM_LOW: "MFP Drum Low",
  MFP_MAINTENANCE_KIT_DUE: "MFP Maintenance Kit Due",
  THERMAL_CLEANING_DUE: "Thermal Cleaning Due",
  THERMAL_MAINTENANCE_DUE: "Thermal Maintenance Due",
  PRINTHEAD_REPLACEMENT_DUE: "Printhead Replacement Due",
  PLATEN_ROLLER_REPLACEMENT_DUE: "Platen Roller Replacement Due",
  STOCK_ITEM_USED: "Stock Item Used",
  STOCK_BELOW_MINIMUM: "Stock Below Minimum",
  CONFLICT_DUPLICATE_IP: "Duplicate IP Conflict",
  CONFLICT_DUPLICATE_MAC: "Duplicate MAC Conflict",
  CONFLICT_OUTSIDE_RANGE: "IP Outside Range",
  CONFLICT_VLAN_MISMATCH: "VLAN Mismatch",
  CONFLICT_UNKNOWN_ACTIVE_IP: "Unknown Active IP",
  CONFLICT_ACTIVE_WHILE_AVAILABLE: "Available Asset Seen Active",
  WARRANTY_EXPIRING: "Warranty Expiring",
  FACTURA_WARRANTY_EXPIRING: "Factura Warranty Expiring",
  MISSING_ASSET_SEEN_ONLINE: "Missing Asset Seen Online",
  FIXED_ASSET_MOVED: "Fixed Asset Moved",
};

export const alertStatusLabels: Record<AlertStatus, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  IGNORED: "Ignored",
};

export const alertSeverityLabels: Record<AlertSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const alertSourceLabels: Record<AlertSource, string> = {
  IPAM: "IPAM",
  STOCK: "Stock",
  PRINTER: "Printer",
  FACTURA: "Factura",
  WARRANTY: "Warranty",
  MISSING_ASSET: "Missing Asset",
  UNIFI: "Read-only UniFi",
  MOVEMENT: "Movement",
  SYSTEM: "System",
};

export const scheduledJobTypeLabels: Record<ScheduledJobType, string> = {
  ALERT_REFRESH: "Alert Refresh",
  CONFLICT_DETECTION: "Conflict Detection",
  STOCK_ALERT_CHECK: "Stock Alert Check",
  WARRANTY_ALERT_CHECK: "Warranty Alert Check",
  PRINTER_MAINTENANCE_CHECK: "Printer Maintenance Check",
  MOVEMENT_ALERT_CHECK_EXISTING_DATA_ONLY: "Movement Alert Check",
};

export const scheduledJobLastStatusLabels: Record<ScheduledJobLastStatus, string> = {
  SUCCESS: "Success",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

export const jobRunStatusLabels: Record<JobRunStatus, string> = {
  SUCCESS: "Success",
  FAILED: "Failed",
  PARTIAL: "Partial",
};

export const assetPhotoTypeLabels: Record<AssetPhotoType, string> = {
  MAIN: "Main Photo",
  SERIAL_LABEL: "Serial Label",
  MAC_IP_LABEL: "MAC/IP Label",
  CONDITION: "Condition",
  DAMAGE: "Damage",
  ACCESSORIES: "Accessories",
  RETURN_CONDITION: "Return Condition",
  OTHER: "Other",
};

export const assetPhotoTypeOptions = Object.keys(assetPhotoTypeLabels) as AssetPhotoType[];
