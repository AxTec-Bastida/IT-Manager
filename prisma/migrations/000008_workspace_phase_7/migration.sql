-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" DATETIME,
    "reminderDate" DATETIME,
    "assignedTo" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "relatedDeviceId" TEXT,
    "relatedEmployeeId" TEXT,
    "relatedStockItemId" TEXT,
    "relatedFacturaId" TEXT,
    "relatedAlertId" TEXT,
    "notes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_relatedDeviceId_fkey" FOREIGN KEY ("relatedDeviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_relatedEmployeeId_fkey" FOREIGN KEY ("relatedEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_relatedStockItemId_fkey" FOREIGN KEY ("relatedStockItemId") REFERENCES "StockItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_relatedFacturaId_fkey" FOREIGN KEY ("relatedFacturaId") REFERENCES "Factura" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_relatedAlertId_fkey" FOREIGN KEY ("relatedAlertId") REFERENCES "Alert" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT,
    "title" TEXT NOT NULL,
    "vendorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT,
    "requestedBy" TEXT,
    "requestedAt" DATETIME,
    "approvedAt" DATETIME,
    "orderedAt" DATETIME,
    "expectedDeliveryAt" DATETIME,
    "receivedAt" DATETIME,
    "followUpDate" DATETIME,
    "estimatedAmount" REAL,
    "currency" TEXT DEFAULT 'USD',
    "relatedFacturaId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseNote_relatedFacturaId_fkey" FOREIGN KEY ("relatedFacturaId") REFERENCES "Factura" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseNoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER,
    "unitCost" REAL,
    "relatedStockItemId" TEXT,
    "relatedDeviceId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseNoteItem_purchaseNoteId_fkey" FOREIGN KEY ("purchaseNoteId") REFERENCES "PurchaseNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseNoteItem_relatedStockItemId_fkey" FOREIGN KEY ("relatedStockItemId") REFERENCES "StockItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseNoteItem_relatedDeviceId_fkey" FOREIGN KEY ("relatedDeviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "requiresVpn" BOOLEAN NOT NULL DEFAULT false,
    "internalOnly" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_category_idx" ON "Task"("category");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_assignedTo_idx" ON "Task"("assignedTo");

-- CreateIndex
CREATE INDEX "Task_relatedDeviceId_idx" ON "Task"("relatedDeviceId");

-- CreateIndex
CREATE INDEX "Task_relatedEmployeeId_idx" ON "Task"("relatedEmployeeId");

-- CreateIndex
CREATE INDEX "Task_relatedStockItemId_idx" ON "Task"("relatedStockItemId");

-- CreateIndex
CREATE INDEX "Task_relatedFacturaId_idx" ON "Task"("relatedFacturaId");

-- CreateIndex
CREATE INDEX "Task_relatedAlertId_idx" ON "Task"("relatedAlertId");

-- CreateIndex
CREATE INDEX "PurchaseNote_poNumber_idx" ON "PurchaseNote"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseNote_title_idx" ON "PurchaseNote"("title");

-- CreateIndex
CREATE INDEX "PurchaseNote_vendorName_idx" ON "PurchaseNote"("vendorName");

-- CreateIndex
CREATE INDEX "PurchaseNote_status_idx" ON "PurchaseNote"("status");

-- CreateIndex
CREATE INDEX "PurchaseNote_priority_idx" ON "PurchaseNote"("priority");

-- CreateIndex
CREATE INDEX "PurchaseNote_followUpDate_idx" ON "PurchaseNote"("followUpDate");

-- CreateIndex
CREATE INDEX "PurchaseNote_expectedDeliveryAt_idx" ON "PurchaseNote"("expectedDeliveryAt");

-- CreateIndex
CREATE INDEX "PurchaseNote_relatedFacturaId_idx" ON "PurchaseNote"("relatedFacturaId");

-- CreateIndex
CREATE INDEX "PurchaseNoteItem_purchaseNoteId_idx" ON "PurchaseNoteItem"("purchaseNoteId");

-- CreateIndex
CREATE INDEX "PurchaseNoteItem_relatedStockItemId_idx" ON "PurchaseNoteItem"("relatedStockItemId");

-- CreateIndex
CREATE INDEX "PurchaseNoteItem_relatedDeviceId_idx" ON "PurchaseNoteItem"("relatedDeviceId");

-- CreateIndex
CREATE INDEX "ToolLink_name_idx" ON "ToolLink"("name");

-- CreateIndex
CREATE INDEX "ToolLink_category_idx" ON "ToolLink"("category");

-- CreateIndex
CREATE INDEX "ToolLink_isFavorite_idx" ON "ToolLink"("isFavorite");

-- CreateIndex
CREATE INDEX "ToolLink_active_idx" ON "ToolLink"("active");
