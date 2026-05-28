import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const activity = await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="Important changes, scans, reservations, and conflict events." />
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {activity.map((item) => (
            <div key={item.id} className="p-4 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{item.message}</p>
                <p className="text-slate-500">{item.createdAt.toLocaleString()}</p>
              </div>
              <p className="mt-1 text-xs uppercase text-slate-500">{item.action}</p>
            </div>
          ))}
          {activity.length === 0 ? <p className="p-4 text-sm text-slate-500">No activity yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
