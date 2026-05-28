import { Clock, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { RunDueJobsButton } from "@/components/run-due-jobs-button";
import { RunJobButton } from "@/components/run-job-button";
import { ensureDefaultJobSchedules } from "@/lib/jobs";
import { jobRunStatusLabels, scheduledJobLastStatusLabels, scheduledJobTypeLabels } from "@/lib/constants";

export const dynamic = "force-dynamic";

function formatDate(date?: Date | null) {
  return date ? date.toLocaleString() : "Not run yet";
}

function statusTone(status?: string | null) {
  if (status === "SUCCESS") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "FAILED") return "bg-rose-100 text-rose-800 ring-rose-200";
  if (status === "SKIPPED" || status === "PARTIAL") return "bg-amber-100 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default async function JobsPage() {
  await ensureDefaultJobSchedules(prisma);
  const [jobs, runs] = await Promise.all([
    prisma.scheduledJob.findMany({ orderBy: [{ enabled: "desc" }, { type: "asc" }] }),
    prisma.jobRun.findMany({ include: { schedule: true }, orderBy: { startedAt: "desc" }, take: 25 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Jobs"
        description="Local scheduled checks for alerts, IPAM conflicts, stock, printer maintenance, warranties, missing assets, and fixed/static movement using already-stored app data."
        action={<RunDueJobsButton />}
      />

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={18} />
          <p>
            These jobs do not add new UniFi integration. Movement and missing-asset checks only use location history and UniFi snapshots already stored in the local database.
          </p>
        </div>
      </section>

      <section className="grid gap-3">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_170px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={job.enabled ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>{job.enabled ? "Enabled" : "Disabled"}</Badge>
                  <Badge className={statusTone(job.lastStatus)}>{job.lastStatus ? scheduledJobLastStatusLabels[job.lastStatus] : "No status"}</Badge>
                </div>
                <h2 className="mt-3 font-semibold text-slate-950">{job.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{scheduledJobTypeLabels[job.type]}</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-4">
                  <span className="inline-flex items-center gap-2"><Clock size={15} />Every {job.intervalMinutes} min</span>
                  <span>Last run: {formatDate(job.lastRunAt)}</span>
                  <span>Next run: {formatDate(job.nextRunAt)}</span>
                  <span>{job.running ? "Currently running" : "Idle"}</span>
                </div>
                {job.lastError ? <p className="mt-3 rounded-md bg-rose-50 p-2 text-sm text-rose-800">{job.lastError}</p> : null}
              </div>
              <RunJobButton jobId={job.id} />
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-950">Recent Job Runs</h2>
          <p className="text-sm text-slate-500">Last 25 runs across all schedules.</p>
        </div>
        <div className="grid gap-3 p-4 lg:hidden">
          {runs.map((run) => (
            <article key={run.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusTone(run.status)}>{jobRunStatusLabels[run.status]}</Badge>
                <span className="text-sm font-semibold text-slate-950">{run.schedule?.name ?? scheduledJobTypeLabels[run.type]}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{scheduledJobTypeLabels[run.type]}</p>
              <p className="mt-1 text-xs text-slate-500">Started {formatDate(run.startedAt)}</p>
              {run.errorMessage ? <p className="mt-2 text-sm text-rose-700">{run.errorMessage}</p> : null}
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Finished</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{run.schedule?.name ?? "Manual run"}</td>
                  <td className="px-4 py-3 text-slate-600">{scheduledJobTypeLabels[run.type]}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(run.startedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(run.finishedAt)}</td>
                  <td className="px-4 py-3"><Badge className={statusTone(run.status)}>{jobRunStatusLabels[run.status]}</Badge></td>
                  <td className="max-w-md px-4 py-3 text-slate-600">{run.errorMessage ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {runs.length === 0 ? <p className="p-4 text-sm text-slate-500">No job runs yet.</p> : null}
      </section>
    </div>
  );
}
