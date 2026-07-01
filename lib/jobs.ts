import type { AlertSeverity, AlertSource, AlertType, PrismaClient, ScheduledJob, ScheduledJobType } from "@prisma/client";
import { runAlertRefresh } from "./alert-refresh";
import { alertCandidateKey, alertRecordKey, type AlertCandidate } from "./alert-workflows";
import { activeAssetLoanStatuses, borrowerLabel as assetLoanBorrowerLabel, isAssetLoanOverdue } from "./asset-loans";
import { detectDuplicateExactValues, detectInvalidIps, detectMobileTrackingViolations, detectNegativeStock } from "./data-integrity";
import { autoWorkflowEmailEnabled, sendAssetLoanWorkflowEmail } from "./email-workflows";
import { refreshRmaReminders } from "./rma";
import { activeStockIssueStatuses, borrowerLabel as stockIssueBorrowerLabel, isStockLoanOverdue } from "./stock-issues";
import { isLegacyUnifiSyncEnabled } from "./unifi-disabled";

export type JobRunnerSummary = {
  jobsChecked: number;
  jobsDue: number;
  jobsRun: number;
  jobsSucceeded: number;
  jobsFailed: number;
  jobsSkipped: number;
  runs: Array<{
    scheduleId: string;
    name: string;
    type: ScheduledJobType;
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    summary?: unknown;
    errorMessage?: string;
  }>;
};

export const defaultJobSchedules: Array<Pick<ScheduledJob, "name" | "type" | "enabled" | "intervalMinutes">> = [
  { name: "Alert refresh", type: "ALERT_REFRESH", enabled: true, intervalMinutes: 15 },
  { name: "RMA reminder refresh", type: "RMA_REMINDER_REFRESH", enabled: true, intervalMinutes: 60 },
  { name: "Asset loan overdue check", type: "ASSET_LOAN_OVERDUE_CHECK", enabled: true, intervalMinutes: 60 },
  { name: "Stock loan overdue check", type: "STOCK_LOAN_OVERDUE_CHECK", enabled: true, intervalMinutes: 60 },
  { name: "Stock alert check", type: "STOCK_ALERT_CHECK", enabled: true, intervalMinutes: 60 },
  { name: "Printer maintenance check", type: "PRINTER_MAINTENANCE_CHECK", enabled: true, intervalMinutes: 720 },
  { name: "Warranty check", type: "WARRANTY_ALERT_CHECK", enabled: true, intervalMinutes: 1440 },
  { name: "Data integrity check", type: "DATA_INTEGRITY_CHECK", enabled: true, intervalMinutes: 1440 },
];

export function isJobDue(job: Pick<ScheduledJob, "enabled" | "nextRunAt" | "running">, now = new Date()) {
  return Boolean(job.enabled && (!job.nextRunAt || job.nextRunAt.getTime() <= now.getTime()));
}

export function selectDueJobs<T extends Pick<ScheduledJob, "enabled" | "nextRunAt" | "running">>(jobs: T[], now = new Date()) {
  return jobs.filter((job) => isJobDue(job, now));
}

export function getNextRunAt(now: Date, intervalMinutes: number) {
  return new Date(now.getTime() + Math.max(1, intervalMinutes) * 60 * 1000);
}

export function createEmptyJobRunnerSummary(jobsDue = 0): JobRunnerSummary {
  return { jobsChecked: jobsDue, jobsDue, jobsRun: 0, jobsSucceeded: 0, jobsFailed: 0, jobsSkipped: 0, runs: [] };
}

export async function runDueJobList<T extends Pick<ScheduledJob, "id" | "name" | "type">>(
  jobs: T[],
  runOne: (job: T) => Promise<JobRunnerSummary["runs"][number]>,
) {
  const summary = createEmptyJobRunnerSummary(jobs.length);
  for (const job of jobs) {
    try {
      const result = await runOne(job);
      summary.runs.push(result);
      if (result.status === "SKIPPED") {
        summary.jobsSkipped += 1;
        continue;
      }
      summary.jobsRun += 1;
      if (result.status === "SUCCESS") summary.jobsSucceeded += 1;
      if (result.status === "FAILED") summary.jobsFailed += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown job failure.";
      summary.jobsRun += 1;
      summary.jobsFailed += 1;
      summary.runs.push({ scheduleId: job.id, name: job.name, type: job.type, status: "FAILED", errorMessage });
    }
  }
  return summary;
}

export async function ensureDefaultJobSchedules(prisma: PrismaClient, now = new Date()) {
  for (const job of defaultJobSchedules) {
    const existing = await prisma.scheduledJob.findFirst({ where: { type: job.type } });
    if (existing) continue;
    await prisma.scheduledJob.create({
      data: {
        ...job,
        nextRunAt: getNextRunAt(now, job.intervalMinutes),
      },
    });
  }
}

async function runJobWork(prisma: PrismaClient, type: ScheduledJobType, now: Date) {
  if (type === "MOVEMENT_ALERT_CHECK_EXISTING_DATA_ONLY" && !isLegacyUnifiSyncEnabled()) {
    return { skipped: true, reason: "Legacy AP sync is disabled by default." };
  }
  if (type === "RMA_REMINDER_REFRESH") return refreshRmaReminders(prisma, now);
  if (type === "ASSET_LOAN_OVERDUE_CHECK") return runAssetLoanOverdueCheck(prisma, now);
  if (type === "STOCK_LOAN_OVERDUE_CHECK") return runStockLoanOverdueCheck(prisma, now);
  if (type === "DATA_INTEGRITY_CHECK") return runDataIntegrityCheck(prisma, now);
  return runAlertRefresh(prisma, type, now);
}

export async function runScheduledJobNow(prisma: PrismaClient, job: ScheduledJob, now = new Date()) {
  const locked = await prisma.scheduledJob.updateMany({
    where: { id: job.id, running: false },
    data: { running: true, lockedAt: now },
  });

  if (locked.count === 0) {
    const finishedAt = new Date();
    await prisma.jobRun.create({
      data: {
        scheduleId: job.id,
        type: job.type,
        startedAt: now,
        finishedAt,
        status: "SKIPPED",
        errorMessage: "Job is already running.",
      },
    });
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: { lastStatus: "SKIPPED", lastError: "Job is already running." },
    });
    return { scheduleId: job.id, name: job.name, type: job.type, status: "SKIPPED" as const, errorMessage: "Job is already running." };
  }

  const startedAt = now;
  try {
    const summary = await runJobWork(prisma, job.type, now);
    const finishedAt = new Date();
    await prisma.jobRun.create({
      data: {
        scheduleId: job.id,
        type: job.type,
        startedAt,
        finishedAt,
        status: "SUCCESS",
        summaryJson: JSON.stringify(summary),
      },
    });
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: finishedAt,
        nextRunAt: getNextRunAt(finishedAt, job.intervalMinutes),
        lastStatus: "SUCCESS",
        lastError: null,
        running: false,
        lockedAt: null,
      },
    });
    await prisma.activityLog.create({
      data: {
        action: "job.completed",
        entity: "scheduled_job",
        entityId: job.id,
        message: `${job.name} completed successfully.`,
        metadata: JSON.stringify(summary),
      },
    });
    return { scheduleId: job.id, name: job.name, type: job.type, status: "SUCCESS" as const, summary };
  } catch (error) {
    const finishedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : "Unknown job failure.";
    await prisma.jobRun.create({
      data: {
        scheduleId: job.id,
        type: job.type,
        startedAt,
        finishedAt,
        status: "FAILED",
        errorMessage,
      },
    });
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: finishedAt,
        nextRunAt: getNextRunAt(finishedAt, job.intervalMinutes),
        lastStatus: "FAILED",
        lastError: errorMessage,
        running: false,
        lockedAt: null,
      },
    });
    await prisma.activityLog.create({
      data: {
        action: "job.failed",
        entity: "scheduled_job",
        entityId: job.id,
        message: `${job.name} failed: ${errorMessage}`,
      },
    });
    return { scheduleId: job.id, name: job.name, type: job.type, status: "FAILED" as const, errorMessage };
  }
}

export async function runDueJobs(prisma: PrismaClient, now = new Date()) {
  await ensureDefaultJobSchedules(prisma, now);
  const dueJobs = await prisma.scheduledJob.findMany({
    where: {
      enabled: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
  });

  const summary = await runDueJobList(dueJobs, (job) => runScheduledJobNow(prisma, job, now));

  await prisma.activityLog.create({
    data: {
      action: "jobs.run_due",
      entity: "scheduled_job",
      message: `Due job run completed: ${summary.jobsSucceeded} succeeded, ${summary.jobsFailed} failed, ${summary.jobsSkipped} skipped.`,
      metadata: JSON.stringify(summary),
    },
  });

  return summary;
}

export async function runAssetLoanOverdueCheck(prisma: PrismaClient, now = new Date()) {
  const settings = await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const sendReminderEmails = autoWorkflowEmailEnabled(settings, "overdue-reminder");
  const loans = await prisma.assetLoan.findMany({
    where: { status: { in: activeAssetLoanStatuses }, expectedReturnAt: { lte: endOfDay(now) } },
    include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } },
  });
  let markedOverdue = 0;
  let alertsCreated = 0;
  let alertsUpdated = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;
  for (const loan of loans) {
    if (isAssetLoanOverdue(loan, now)) {
      if (loan.status !== "OVERDUE") {
        await prisma.assetLoan.update({ where: { id: loan.id }, data: { status: "OVERDUE" } });
        markedOverdue += 1;
      }
      const result = await upsertOperationalAlert(prisma, {
        type: "ASSET_LOAN_OVERDUE",
        source: "SYSTEM",
        severity: "HIGH",
        title: `Asset loan ${loan.loanNumber} overdue`,
        message: `${loan.loanNumber} for ${assetLoanBorrowerLabel(loan)} is ${daysPastDue(loan.expectedReturnAt, now)} day(s) overdue with ${loan.items.filter((item) => item.returnStatus === "PENDING").length} pending asset(s).`,
        metadata: JSON.stringify({ assetLoanId: loan.id, loanNumber: loan.loanNumber }),
        duplicateKey: `asset-loan-overdue:${loan.id}`,
      }, now);
      alertsCreated += result.created;
      alertsUpdated += result.updated;
    }

    if (sendReminderEmails) {
      const todayStart = startOfDay(now);
      const sentLog = await prisma.emailLog.findFirst({
        where: {
          assetLoanId: loan.id,
          type: "OVERDUE_ASSET_LOAN_REMINDER",
          createdAt: { gte: todayStart }
        }
      });
      if (!sentLog) {
        await sendAssetLoanWorkflowEmail(prisma, loan.id, "overdue");
        emailsSent += 1;
      }
    } else {
      emailsSkipped += 1;
    }
  }
  return { loansChecked: loans.length, markedOverdue, alertsCreated, alertsUpdated, emailsSent, emailsSkipped };
}

export async function runStockLoanOverdueCheck(prisma: PrismaClient, now = new Date()) {
  const issues = await prisma.stockIssue.findMany({
    where: { issueType: "LOAN", status: { in: activeStockIssueStatuses }, expectedReturnAt: { lt: startOfDay(now) } },
    include: { stockItem: true, employee: true, temporaryBorrower: true },
  });
  let alertsCreated = 0;
  let alertsUpdated = 0;
  for (const issue of issues) {
    if (!isStockLoanOverdue(issue, now)) continue;
    const result = await upsertOperationalAlert(prisma, {
      type: "STOCK_LOAN_OVERDUE",
      source: "STOCK",
      severity: "MEDIUM",
      title: `Stock loan overdue: ${issue.stockItem.name}`,
      message: `${stockIssueBorrowerLabel(issue)} has ${issue.quantity - issue.returnedQuantity} ${issue.stockItem.name} item(s) overdue by ${daysPastDue(issue.expectedReturnAt!, now)} day(s).`,
      stockItemId: issue.stockItemId,
      metadata: JSON.stringify({ stockIssueId: issue.id, issueNumber: issue.issueNumber }),
      duplicateKey: `stock-loan-overdue:${issue.id}`,
    }, now);
    alertsCreated += result.created;
    alertsUpdated += result.updated;
  }
  return { stockLoansChecked: issues.length, alertsCreated, alertsUpdated };
}

export async function runDataIntegrityCheck(prisma: PrismaClient, now = new Date()) {
  const [devices, stockItems, latestImportRun] = await Promise.all([
    prisma.device.findMany({
      select: {
        id: true,
        assetTag: true,
        serialNumber: true,
        ipAddress: true,
        macAddress: true,
        category: true,
        usesStaticIp: true,
        movementAlertsEnabled: true,
        status: true,
        assetLoanItems: { where: { returnStatus: "PENDING", loan: { status: { in: activeAssetLoanStatuses } } }, select: { id: true } },
        rmaItems: { where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } }, select: { id: true } },
      },
    }),
    prisma.stockItem.findMany({ select: { id: true, quantityOnHand: true } }),
    prisma.importRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const duplicateValues = detectDuplicateExactValues(devices);
  const invalidIps = detectInvalidIps(devices);
  const negativeStock = detectNegativeStock(stockItems);
  const mobileTrackingViolations = detectMobileTrackingViolations(devices);
  const loanedWithoutActiveLoan = devices.filter((device) => device.status === "LOANED_OUT" && device.assetLoanItems.length === 0);
  const activeRmaStatusMismatches = devices.filter((device) => device.rmaItems.length > 0 && device.status !== "IN_REPAIR_RMA");
  const summary = {
    checkedAt: now.toISOString(),
    latestImportRunId: latestImportRun?.id ?? null,
    invalidIps: invalidIps.length,
    negativeStock: negativeStock.length,
    exactDuplicateAssetTags: duplicateValues.assetTagDuplicates.length,
    exactDuplicateSerials: duplicateValues.serialDuplicates.length,
    mobileTrackingViolations: mobileTrackingViolations.length,
    loanedWithoutActiveLoan: loanedWithoutActiveLoan.length,
    activeRmaStatusMismatches: activeRmaStatusMismatches.length,
  };
  const issueCount = Object.entries(summary).filter(([, value]) => typeof value === "number").reduce((total, [, value]) => total + Number(value), 0);
  let alertsCreated = 0;
  let alertsUpdated = 0;
  if (issueCount > 0) {
    const result = await upsertOperationalAlert(prisma, {
      type: "DATA_INTEGRITY_WARNING",
      source: "SYSTEM",
      severity: issueCount > 5 ? "HIGH" : "MEDIUM",
      title: "Data integrity review needed",
      message: `Scheduled data integrity check found ${issueCount} manual review item(s). Open Data Quality for details.`,
      metadata: JSON.stringify({ ...summary }),
      duplicateKey: "data-integrity:scheduled",
    }, now);
    alertsCreated += result.created;
    alertsUpdated += result.updated;
  }
  return { ...summary, issueCount, alertsCreated, alertsUpdated };
}

async function upsertOperationalAlert(
  prisma: PrismaClient,
  candidate: AlertCandidate & { type: AlertType; source: AlertSource; severity: AlertSeverity },
  now = new Date(),
) {
  const key = alertCandidateKey(candidate);
  const metadata = JSON.stringify({ ...parseMetadata(candidate.metadata), duplicateKey: key });
  const existingAlerts = await prisma.alert.findMany({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] }, type: candidate.type } });
  const existing = existingAlerts.find((alert) => alertRecordKey(alert) === key);
  if (existing) {
    await prisma.alert.update({
      where: { id: existing.id },
      data: {
        source: candidate.source,
        severity: candidate.severity,
        title: candidate.title,
        message: candidate.message,
        assetId: candidate.assetId ?? null,
        stockItemId: candidate.stockItemId ?? null,
        metadata,
        lastSeenAt: now,
      },
    });
    return { created: 0, updated: 1 };
  }
  await prisma.alert.create({
    data: {
      type: candidate.type,
      source: candidate.source,
      severity: candidate.severity,
      title: candidate.title,
      message: candidate.message,
      assetId: candidate.assetId ?? null,
      stockItemId: candidate.stockItemId ?? null,
      metadata,
      firstSeenAt: now,
      lastSeenAt: now,
    },
  });
  return { created: 1, updated: 0 };
}

function parseMetadata(metadata?: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function daysPastDue(date: Date, now = new Date()) {
  return Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000));
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
