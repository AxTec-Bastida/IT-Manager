import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ScannerPanel } from "@/components/scanner-panel";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const [ranges, settings, runs] = await Promise.all([
    prisma.ipRange.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    prisma.scanRun.findMany({ include: { results: true }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network scanner"
        description="Runs server-side ping/ARP checks with a safety limit. Some devices block ping, so scan misses are informational."
      />
      <ScannerPanel ranges={ranges} defaults={{ maxScanSize: settings.maxScanSize, pingTimeoutMs: settings.pingTimeoutMs }} />
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Recent scans</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {runs.map((run) => (
            <div key={run.id} className="py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-slate-950">{run.rangeName}</span>
                <span className="text-slate-500">{run.startedAt.toLocaleString()}</span>
              </div>
              <p className="text-slate-600">
                {run.startIp} - {run.endIp}; {run.results.filter((result) => result.reachable).length}/{run.results.length} reachable
              </p>
            </div>
          ))}
          {runs.length === 0 ? <p className="text-sm text-slate-500">No scans have been run yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
