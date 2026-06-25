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
  PurchaseNoteStatus,
  ScheduledJobLastStatus,
  ScheduledJobType,
  StockCategory,
  StockIssueStatus,
  StockIssueType,
  StockItemPhotoType,
  StockItemType,
  StockMovementType,
  StockReturnCondition,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  ToolLinkCategory,
  RmaCaseStatus,
  RmaItemResult,
  AssetLoanStatus,
  AssetLoanItemReturnStatus,
  AssetLoanReturnCondition,
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
  CHARGER: "Charger",
  ADAPTER: "Adapter",
  ACCESSORY: "Accessory",
  DISPLAY_BASE: "Display Base",
  DOCK: "Dock",
  PRINTER_SUPPLY: "Printer Supply",
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
  LOANED_OUT: "Loaned Out",
  RETURNED_TO_STOCK: "Returned to Stock",
  RECEIVE: "Receive New Stock",
  RESTOCK: "Restock Existing Item",
  ISSUE: "Issue Consumable",
  RETURN: "Return Usable Stock",
  PHYSICAL_COUNT: "Physical Count Correction",
  ADJUSTMENT: "Quantity Adjustment",
  DAMAGED: "Damaged Stock",
  LOST: "Lost Stock",
};

export const stockMovementTypeOptions = Object.keys(stockMovementTypeLabels) as StockMovementType[];

export const stockIssueTypeLabels: Record<StockIssueType, string> = {
  HANDOUT: "Handout",
  LOAN: "Loan",
};

export const stockIssueTypeOptions = Object.keys(stockIssueTypeLabels) as StockIssueType[];

export const stockIssueStatusLabels: Record<StockIssueStatus, string> = {
  ACTIVE: "Active",
  RETURNED: "Returned",
  PARTIALLY_RETURNED: "Partially Returned",
  CANCELLED: "Cancelled",
};

export const stockIssueStatusTone: Record<StockIssueStatus, string> = {
  ACTIVE: "bg-amber-100 text-amber-900 ring-amber-200",
  RETURNED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  PARTIALLY_RETURNED: "bg-sky-100 text-sky-800 ring-sky-200",
  CANCELLED: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const stockReturnConditionLabels: Record<StockReturnCondition, string> = {
  GOOD: "Good",
  FAIR: "Fair",
  DAMAGED: "Damaged",
  NOT_WORKING: "Not Working",
  MISSING: "Missing",
};

export const stockReturnConditionOptions = Object.keys(stockReturnConditionLabels) as StockReturnCondition[];

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  CLEANING: "Cleaning",
  CLEAN_PRINTHEAD: "Clean Printhead",
  CLEAN_ROLLER: "Clean Roller",
  PREVENTIVE_MAINTENANCE: "Preventive Maintenance",
  TONER_REPLACEMENT: "Toner Replacement",
  INK_REPLACEMENT: "Ink Replacement",
  DRUM_REPLACEMENT: "Drum Replacement",
  FUSER_REPLACEMENT: "Fuser Replacement",
  PRINTHEAD_REPLACEMENT: "Printhead Replacement",
  REPLACE_PRINTHEAD: "Replace Printhead",
  REPLACE_ROLLER: "Replace Roller",
  REPLACE_LABEL_SENSOR: "Replace Label Sensor",
  REPLACE_PLATEN_ROLLER: "Replace Platen Roller",
  PLATEN_ROLLER_REPLACEMENT: "Platen Roller Replacement",
  CUTTER_REPLACEMENT: "Cutter Replacement",
  POWER_SUPPLY_REPLACEMENT: "Power Supply Replacement",
  TEST_PRINT: "Test Print",
  NETWORK_CHECK: "Network Check",
  FIRMWARE_OR_CONFIG_CHECK: "Firmware / Config Check",
  CALIBRATION_CHECK: "Calibration Check",
  WEIGHT_TEST: "Weight Test",
  POWER_CHECK: "Power Check",
  DISPLAY_CHECK: "Display Check",
  RELOCATION_CHECK: "Relocation Check",
  GENERAL_REPAIR: "General Repair",
  REPAIR: "Repair",
  INSPECTION: "Inspection",
  OTHER: "Other",
};

export const maintenanceTypeOptions = Object.keys(maintenanceTypeLabels) as MaintenanceType[];

export const printerMaintenanceTypeOptions: MaintenanceType[] = [
  "CLEAN_PRINTHEAD",
  "CLEAN_ROLLER",
  "REPLACE_PRINTHEAD",
  "REPLACE_ROLLER",
  "REPLACE_LABEL_SENSOR",
  "REPLACE_PLATEN_ROLLER",
  "TONER_REPLACEMENT",
  "INK_REPLACEMENT",
  "DRUM_REPLACEMENT",
  "FUSER_REPLACEMENT",
  "CUTTER_REPLACEMENT",
  "PREVENTIVE_MAINTENANCE",
  "TEST_PRINT",
  "NETWORK_CHECK",
  "FIRMWARE_OR_CONFIG_CHECK",
  "GENERAL_REPAIR",
  "OTHER",
];

export const scaleMaintenanceTypeOptions: MaintenanceType[] = [
  "CALIBRATION_CHECK",
  "WEIGHT_TEST",
  "POWER_CHECK",
  "NETWORK_CHECK",
  "DISPLAY_CHECK",
  "CLEANING",
  "RELOCATION_CHECK",
  "GENERAL_REPAIR",
  "OTHER",
];

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
  RMA_FOLLOW_UP_DUE: "RMA Follow-up Due",
  RMA_ACTIVE_REMINDER: "RMA Active Reminder",
  RMA_OVERDUE: "RMA Overdue",
  ASSET_LOAN_OVERDUE: "Asset Loan Overdue",
  STOCK_LOAN_OVERDUE: "Stock Loan Overdue",
  DATA_INTEGRITY_WARNING: "Data Integrity Warning",
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
  UNIFI: "Legacy AP Sync (Disabled)",
  MOVEMENT: "Location Movement",
  SYSTEM: "System",
};

export const scheduledJobTypeLabels: Record<ScheduledJobType, string> = {
  ALERT_REFRESH: "Alert Refresh",
  RMA_REMINDER_REFRESH: "RMA Reminder Refresh",
  ASSET_LOAN_OVERDUE_CHECK: "Asset Loan Overdue Check",
  STOCK_LOAN_OVERDUE_CHECK: "Stock Loan Overdue Check",
  CONFLICT_DETECTION: "Conflict Detection",
  STOCK_ALERT_CHECK: "Stock Alert Check",
  WARRANTY_ALERT_CHECK: "Warranty Alert Check",
  PRINTER_MAINTENANCE_CHECK: "Printer Maintenance Check",
  DATA_INTEGRITY_CHECK: "Data Integrity Check",
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
  SKIPPED: "Skipped",
};

export const assetPhotoTypeLabels: Record<AssetPhotoType, string> = {
  MAIN: "Main Photo",
  OVERVIEW: "Overview",
  ASSET_TAG: "Asset Tag",
  SERIAL_LABEL: "Serial Label",
  MAC_IP_LABEL: "MAC/IP Label",
  CONDITION: "Condition",
  DAMAGE: "Damage",
  ACCESSORIES: "Accessories",
  LOCATION_INSTALLED: "Location / Installed",
  FACTURA_EVIDENCE: "Factura Evidence",
  RMA_CONDITION: "RMA Condition",
  RETURN_CONDITION: "Return Condition",
  OTHER: "Other",
};

export const assetPhotoTypeOptions = Object.keys(assetPhotoTypeLabels) as AssetPhotoType[];

export const stockItemPhotoTypeLabels: Record<StockItemPhotoType, string> = {
  OVERVIEW: "Overview",
  PACKAGING: "Packaging",
  SKU_LABEL: "SKU Label",
  STORAGE_LOCATION: "Storage Location",
  OTHER: "Other",
};

export const stockItemPhotoTypeOptions = Object.keys(stockItemPhotoTypeLabels) as StockItemPhotoType[];

export const taskStatusLabels: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING: "Waiting",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const taskStatusOptions = Object.keys(taskStatusLabels) as TaskStatus[];

export const taskStatusTone: Record<TaskStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800 ring-blue-200",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  WAITING: "bg-amber-100 text-amber-900 ring-amber-200",
  DONE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const taskPriorityOptions = Object.keys(taskPriorityLabels) as TaskPriority[];

export const taskPriorityTone: Record<TaskPriority, string> = {
  LOW: "bg-sky-100 text-sky-800 ring-sky-200",
  MEDIUM: "bg-slate-100 text-slate-700 ring-slate-200",
  HIGH: "bg-orange-100 text-orange-900 ring-orange-200",
  URGENT: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const taskCategoryLabels: Record<TaskCategory, string> = {
  GENERAL: "General",
  INVENTORY: "Asset Follow-up",
  MAINTENANCE: "Repair / RMA",
  STOCK: "Stock / Consumables",
  PURCHASE: "Purchase / PO",
  RMA: "Repair / RMA",
  WARRANTY: "Warranty / Factura",
  ALERT: "General",
  OTHER: "General",
  ASSET_FOLLOW_UP: "Asset Follow-up",
  INSTALL_COMMISSION: "Install / Commission",
  MOVE_RELOCATE: "Move / Relocate",
  REPAIR_RMA: "Repair / RMA",
  STOCK_CONSUMABLES: "Stock / Consumables",
  AUDIT_FINDING: "Audit Finding",
  LABEL_QR_ISSUE: "Label / QR Issue",
  PHOTO_COMPLIANCE: "Photo / Compliance",
  NETWORK_IP_MAC: "Network / IP / MAC",
  WARRANTY_FACTURA: "Warranty / Factura",
  PURCHASE_PO: "Purchase / PO",
  SECURITY_ACCESS: "Security / Access",
};

export const taskCategoryOptions: TaskCategory[] = [
  "GENERAL",
  "ASSET_FOLLOW_UP",
  "INSTALL_COMMISSION",
  "MOVE_RELOCATE",
  "REPAIR_RMA",
  "STOCK_CONSUMABLES",
  "AUDIT_FINDING",
  "LABEL_QR_ISSUE",
  "PHOTO_COMPLIANCE",
  "NETWORK_IP_MAC",
  "WARRANTY_FACTURA",
  "PURCHASE_PO",
  "SECURITY_ACCESS",
];

export const purchaseNoteStatusLabels: Record<PurchaseNoteStatus, string> = {
  DRAFT: "Draft",
  REQUESTED: "Requested",
  QUOTED: "Quoted",
  APPROVED: "Approved",
  ORDERED: "Ordered",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  FACTURA_PENDING: "Factura Pending",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const purchaseNoteStatusOptions = Object.keys(purchaseNoteStatusLabels) as PurchaseNoteStatus[];

export const purchaseNoteStatusTone: Record<PurchaseNoteStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  REQUESTED: "bg-blue-100 text-blue-800 ring-blue-200",
  QUOTED: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  APPROVED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  ORDERED: "bg-violet-100 text-violet-800 ring-violet-200",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-900 ring-amber-200",
  RECEIVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  FACTURA_PENDING: "bg-orange-100 text-orange-900 ring-orange-200",
  CLOSED: "bg-green-100 text-green-800 ring-green-200",
  CANCELLED: "bg-zinc-200 text-zinc-700 ring-zinc-300",
};

export const toolLinkCategoryLabels: Record<ToolLinkCategory, string> = {
  NETWORK: "Network",
  INVENTORY: "Inventory",
  PRINTERS: "Printers",
  WAREHOUSE_SYSTEMS: "Warehouse Systems",
  SECURITY_CAMERAS: "Security Cameras",
  GOOGLE_ADMIN: "Google Admin",
  MICROSOFT: "Microsoft",
  MDM: "MDM",
  VENDORS: "Vendors",
  DOCUMENTS_SOPS: "Documents / SOPs",
  RMA_WARRANTY: "RMA / Warranty",
  REPORTS: "Reports",
  OTHER: "Other",
};

export const toolLinkCategoryOptions = Object.keys(toolLinkCategoryLabels) as ToolLinkCategory[];

export const rmaCaseStatusLabels: Record<RmaCaseStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACTIVE: "Active",
  PARTIALLY_RETURNED: "Partially Returned",
  RETURNED: "Returned",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const rmaCaseStatusTone: Record<RmaCaseStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  SENT: "bg-blue-100 text-blue-800 ring-blue-200",
  ACTIVE: "bg-amber-100 text-amber-900 ring-amber-200",
  PARTIALLY_RETURNED: "bg-violet-100 text-violet-800 ring-violet-200",
  RETURNED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CLOSED: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  CANCELLED: "bg-stone-200 text-stone-700 ring-stone-300",
};

export const rmaItemResultLabels: Record<RmaItemResult, string> = {
  PENDING: "Pending",
  REPAIRED: "Repaired",
  REPLACED: "Replaced",
  REJECTED: "Rejected",
  LOST: "Lost",
  RETIRED: "Retired",
  RETURNED_AS_IS: "Returned As-Is",
};

export const rmaItemResultTone: Record<RmaItemResult, string> = {
  PENDING: "bg-amber-100 text-amber-900 ring-amber-200",
  REPAIRED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REPLACED: "bg-blue-100 text-blue-800 ring-blue-200",
  REJECTED: "bg-orange-100 text-orange-900 ring-orange-200",
  LOST: "bg-rose-100 text-rose-800 ring-rose-200",
  RETIRED: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  RETURNED_AS_IS: "bg-sky-100 text-sky-800 ring-sky-200",
};

export const assetLoanStatusLabels: Record<AssetLoanStatus, string> = {
  ACTIVE: "Active",
  RETURNED: "Returned",
  OVERDUE: "Overdue",
  PARTIALLY_RETURNED: "Partially Returned",
  CANCELLED: "Cancelled",
  LOST: "Lost",
  RETURNED_DAMAGED: "Returned Damaged",
};

export const assetLoanStatusTone: Record<AssetLoanStatus, string> = {
  ACTIVE: "bg-blue-100 text-blue-800 ring-blue-200",
  RETURNED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  OVERDUE: "bg-rose-100 text-rose-800 ring-rose-200",
  PARTIALLY_RETURNED: "bg-violet-100 text-violet-800 ring-violet-200",
  CANCELLED: "bg-slate-100 text-slate-700 ring-slate-200",
  LOST: "bg-red-100 text-red-800 ring-red-200",
  RETURNED_DAMAGED: "bg-orange-100 text-orange-900 ring-orange-200",
};

export const assetLoanItemReturnStatusLabels: Record<AssetLoanItemReturnStatus, string> = {
  PENDING: "Pending",
  RETURNED: "Returned",
  RETURNED_DAMAGED: "Returned Damaged",
  MISSING_ACCESSORIES: "Missing Accessories",
  LOST: "Lost",
  CANCELLED: "Cancelled",
};

export const assetLoanItemReturnStatusTone: Record<AssetLoanItemReturnStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900 ring-amber-200",
  RETURNED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  RETURNED_DAMAGED: "bg-orange-100 text-orange-900 ring-orange-200",
  MISSING_ACCESSORIES: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
  LOST: "bg-rose-100 text-rose-800 ring-rose-200",
  CANCELLED: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const assetLoanReturnConditionLabels: Record<AssetLoanReturnCondition, string> = {
  GOOD: "Good",
  FAIR: "Fair",
  DAMAGED: "Damaged",
  NOT_WORKING: "Not Working",
  MISSING_ACCESSORIES: "Missing Accessories",
  LOST: "Lost",
};

export const assetLoanReturnConditionOptions = Object.keys(assetLoanReturnConditionLabels) as AssetLoanReturnCondition[];
