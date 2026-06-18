import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { OfflineQueuePanel } from "@/components/offline-queue-panel";

export const dynamic = "force-dynamic";

export default async function OfflinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/offline");
  const recentRecords = await prisma.offlineSyncRecord.findMany({
    where: { actorUserId: user.id },
    orderBy: { processedAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Offline Queue" description="Local action queue foundation for future offline workflows. Real inventory-changing offline actions are not enabled yet." />
      <OfflineQueuePanel userId={user.id} appVersion="0.1.0" />
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-950">Recent server sync records</h2>
        <p className="mt-1 text-sm text-slate-600">These are sanitized records created after local queued actions sync to the server.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {recentRecords.map((record) => (
            <div key={record.id} className="py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{record.actionType} · {record.status}</p>
                <p className="text-xs text-slate-500">{record.processedAt?.toLocaleString() || record.createdAt.toLocaleString()}</p>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">{record.clientActionId}</p>
            </div>
          ))}
          {recentRecords.length === 0 ? <p className="py-3 text-sm text-slate-500">No server sync records yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
