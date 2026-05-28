PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Device" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assetTag" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "ipAddress" TEXT,
  "macAddress" TEXT,
  "vlan" INTEGER,
  "location" TEXT,
  "areaDepartment" TEXT,
  "brand" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "condition" TEXT NOT NULL DEFAULT 'GOOD',
  "assignedTo" TEXT,
  "employeeId" TEXT,
  "purchaseDate" DATETIME,
  "warrantyExpiresAt" DATETIME,
  "repairNotes" TEXT,
  "notes" TEXT,
  "lastSeenAt" DATETIME,
  "ipRangeId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Device_ipRangeId_fkey" FOREIGN KEY ("ipRangeId") REFERENCES "IpRange" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Device_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Device" (
  "id", "name", "category", "ipAddress", "macAddress", "vlan", "location", "brand", "model",
  "serialNumber", "status", "assignedTo", "notes", "lastSeenAt", "ipRangeId", "createdAt", "updatedAt"
)
SELECT
  "id", "name", "category", "ipAddress", "macAddress", "vlan", "location", "brand", "model",
  "serialNumber", "status", "assignedTo", "notes", "lastSeenAt", "ipRangeId", "createdAt", "updatedAt"
FROM "Device";

DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";

CREATE TABLE "Employee" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "employeeId" TEXT,
  "email" TEXT,
  "department" TEXT,
  "title" TEXT,
  "site" TEXT,
  "supervisorName" TEXT,
  "supervisorEmail" TEXT,
  "phoneNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentNumber" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assignedBy" TEXT,
  "assignmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signatureData" TEXT,
  "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  "termsText" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "emailSentAt" DATETIME,
  "emailTo" TEXT,
  "emailCc" TEXT,
  "emailError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AssignmentItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "assignedCondition" TEXT,
  "returnedCondition" TEXT,
  "returnedAt" DATETIME,
  "returnNotes" TEXT,
  "returnStatus" TEXT NOT NULL DEFAULT 'NOT_RETURNED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AssignmentItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AssignmentItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Device_assetTag_key" ON "Device"("assetTag");
CREATE INDEX "Device_ipAddress_idx" ON "Device"("ipAddress");
CREATE INDEX "Device_macAddress_idx" ON "Device"("macAddress");
CREATE INDEX "Device_assetTag_idx" ON "Device"("assetTag");
CREATE INDEX "Device_serialNumber_idx" ON "Device"("serialNumber");
CREATE INDEX "Device_category_idx" ON "Device"("category");
CREATE INDEX "Device_status_idx" ON "Device"("status");
CREATE INDEX "Device_condition_idx" ON "Device"("condition");
CREATE INDEX "Device_employeeId_idx" ON "Device"("employeeId");
CREATE INDEX "Device_vlan_idx" ON "Device"("vlan");
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");
CREATE INDEX "Employee_email_idx" ON "Employee"("email");
CREATE INDEX "Employee_department_idx" ON "Employee"("department");
CREATE INDEX "Employee_site_idx" ON "Employee"("site");
CREATE INDEX "Employee_status_idx" ON "Employee"("status");
CREATE UNIQUE INDEX "Assignment_assignmentNumber_key" ON "Assignment"("assignmentNumber");
CREATE INDEX "Assignment_employeeId_idx" ON "Assignment"("employeeId");
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");
CREATE INDEX "Assignment_assignmentDate_idx" ON "Assignment"("assignmentDate");
CREATE INDEX "AssignmentItem_assignmentId_idx" ON "AssignmentItem"("assignmentId");
CREATE INDEX "AssignmentItem_assetId_idx" ON "AssignmentItem"("assetId");
CREATE INDEX "AssignmentItem_returnStatus_idx" ON "AssignmentItem"("returnStatus");

PRAGMA foreign_keys=ON;

UPDATE "AppSettings"
SET "siteName" = 'Warehouse IT Inventory'
WHERE "id" = 'default' AND "siteName" = 'Warehouse IPAM';
