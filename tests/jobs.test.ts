import { describe, expect, it } from "vitest";
import { defaultJobSchedules, getNextRunAt, isJobDue, runDueJobList, selectDueJobs } from "@/lib/jobs";

const now = new Date("2026-05-07T12:00:00.000Z");

function job(overrides = {}) {
  return {
    id: "job-1",
    name: "Alert refresh",
    type: "ALERT_REFRESH" as const,
    enabled: true,
    intervalMinutes: 15,
    lastRunAt: null,
    nextRunAt: new Date("2026-05-07T11:59:00.000Z"),
    lastStatus: null,
    lastError: null,
    running: false,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("scheduled jobs", () => {
  it("detects due jobs", () => {
    expect(isJobDue(job(), now)).toBe(true);
    expect(isJobDue(job({ nextRunAt: new Date("2026-05-07T12:01:00.000Z") }), now)).toBe(false);
    expect(isJobDue(job({ nextRunAt: null }), now)).toBe(true);
  });

  it("does not run disabled or already-running jobs", () => {
    const due = selectDueJobs([job(), job({ id: "disabled", enabled: false }), job({ id: "running", running: true })], now);
    expect(due.map((item) => item.id)).toEqual(["job-1"]);
  });

  it("calculates nextRunAt from interval minutes", () => {
    expect(getNextRunAt(now, 15).toISOString()).toBe("2026-05-07T12:15:00.000Z");
  });

  it("summarizes successful alert refresh jobs", async () => {
    const summary = await runDueJobList([job()], async (item) => ({
      scheduleId: item.id,
      name: item.name,
      type: item.type,
      status: "SUCCESS" as const,
      summary: { alertsCreated: 1, alertsUpdated: 2, alertsResolved: 0, alertsSkipped: 0, errors: [] },
    }));
    expect(summary.jobsDue).toBe(1);
    expect(summary.jobsSucceeded).toBe(1);
    expect(summary.runs[0].summary).toMatchObject({ alertsCreated: 1 });
  });

  it("continues if one job fails", async () => {
    const jobs = [job({ id: "bad", name: "Bad job" }), job({ id: "good", name: "Good job" })];
    const summary = await runDueJobList(jobs, async (item) => {
      if (item.id === "bad") throw new Error("boom");
      return { scheduleId: item.id, name: item.name, type: item.type, status: "SUCCESS" as const };
    });
    expect(summary.jobsFailed).toBe(1);
    expect(summary.jobsSucceeded).toBe(1);
    expect(summary.runs.map((run) => run.status)).toEqual(["FAILED", "SUCCESS"]);
  });

  it("includes movement check as existing-data-only", () => {
    expect(defaultJobSchedules.some((item) => item.type === "MOVEMENT_ALERT_CHECK_EXISTING_DATA_ONLY")).toBe(true);
  });
});
