import type { PrismaClient, ScheduledJob, ScheduledJobType } from "@prisma/client";
import { runAlertRefresh } from "./alert-refresh";

export type JobRunnerSummary = {
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
  { name: "IPAM conflict detection", type: "CONFLICT_DETECTION", enabled: true, intervalMinutes: 15 },
  { name: "Stock alert check", type: "STOCK_ALERT_CHECK", enabled: true, intervalMinutes: 60 },
  { name: "Printer maintenance check", type: "PRINTER_MAINTENANCE_CHECK", enabled: true, intervalMinutes: 60 },
  { name: "Warranty check", type: "WARRANTY_ALERT_CHECK", enabled: true, intervalMinutes: 1440 },
  { name: "Movement alert check", type: "MOVEMENT_ALERT_CHECK_EXISTING_DATA_ONLY", enabled: true, intervalMinutes: 30 },
];

export function isJobDue(job: Pick<ScheduledJob, "enabled" | "nextRunAt" | "running">, now = new Date()) {
  return Boolean(job.enabled && !job.running && (!job.nextRunAt || job.nextRunAt.getTime() <= now.getTime()));
}

export function selectDueJobs<T extends Pick<ScheduledJob, "enabled" | "nextRunAt" | "running">>(jobs: T[], now = new Date()) {
  return jobs.filter((job) => isJobDue(job, now));
}

export function getNextRunAt(now: Date, intervalMinutes: number) {
  return new Date(now.getTime() + Math.max(1, intervalMinutes) * 60 * 1000);
}

export function createEmptyJobRunnerSummary(jobsDue = 0): JobRunnerSummary {
  return { jobsDue, jobsRun: 0, jobsSucceeded: 0, jobsFailed: 0, jobsSkipped: 0, runs: [] };
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
  return runAlertRefresh(prisma, type, now);
}

export async function runScheduledJobNow(prisma: PrismaClient, job: ScheduledJob, now = new Date()) {
  const locked = await prisma.scheduledJob.updateMany({
    where: { id: job.id, running: false },
    data: { running: true, lockedAt: now },
  });

  if (locked.count === 0) {
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
      running: false,
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
