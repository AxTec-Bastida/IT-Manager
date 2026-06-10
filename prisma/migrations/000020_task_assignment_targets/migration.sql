CREATE TABLE "AssignmentTarget" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "path" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AssignmentTarget_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssignmentTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AssignmentTarget_type_path_key" ON "AssignmentTarget"("type", "path");
CREATE INDEX "AssignmentTarget_type_idx" ON "AssignmentTarget"("type");
CREATE INDEX "AssignmentTarget_parentId_idx" ON "AssignmentTarget"("parentId");
CREATE INDEX "AssignmentTarget_isActive_idx" ON "AssignmentTarget"("isActive");
CREATE INDEX "AssignmentTarget_path_idx" ON "AssignmentTarget"("path");

ALTER TABLE "Task" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "Task" ADD COLUMN "assignedToName" TEXT;
ALTER TABLE "Task" ADD COLUMN "assignedToRole" TEXT;
CREATE INDEX "Task_assignedToUserId_idx" ON "Task"("assignedToUserId");

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Assignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentNumber" TEXT NOT NULL,
  "employeeId" TEXT,
  "targetId" TEXT,
  "targetType" TEXT NOT NULL DEFAULT 'EMPLOYEE',
  "targetName" TEXT,
  "targetPath" TEXT,
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
  CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Assignment_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "AssignmentTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Assignment" (
  "id",
  "assignmentNumber",
  "employeeId",
  "targetType",
  "targetName",
  "targetPath",
  "assignedBy",
  "assignmentDate",
  "signatureData",
  "termsAccepted",
  "termsText",
  "notes",
  "status",
  "emailSentAt",
  "emailTo",
  "emailCc",
  "emailError",
  "createdAt",
  "updatedAt"
)
SELECT
  "Assignment"."id",
  "Assignment"."assignmentNumber",
  "Assignment"."employeeId",
  'EMPLOYEE',
  "Employee"."fullName",
  "Employee"."fullName",
  "Assignment"."assignedBy",
  "Assignment"."assignmentDate",
  "Assignment"."signatureData",
  "Assignment"."termsAccepted",
  "Assignment"."termsText",
  "Assignment"."notes",
  "Assignment"."status",
  "Assignment"."emailSentAt",
  "Assignment"."emailTo",
  "Assignment"."emailCc",
  "Assignment"."emailError",
  "Assignment"."createdAt",
  "Assignment"."updatedAt"
FROM "Assignment"
LEFT JOIN "Employee" ON "Employee"."id" = "Assignment"."employeeId";

DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";

CREATE UNIQUE INDEX "Assignment_assignmentNumber_key" ON "Assignment"("assignmentNumber");
CREATE INDEX "Assignment_employeeId_idx" ON "Assignment"("employeeId");
CREATE INDEX "Assignment_targetId_idx" ON "Assignment"("targetId");
CREATE INDEX "Assignment_targetType_idx" ON "Assignment"("targetType");
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");
CREATE INDEX "Assignment_assignmentDate_idx" ON "Assignment"("assignmentDate");

PRAGMA foreign_keys=ON;
