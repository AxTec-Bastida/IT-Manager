import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { OfflineQueuePanel } from "@/components/offline-queue-panel";
import { ActionLink, PageActions } from "@/components/ui-patterns";

export const dynamic = "force-dynamic";

export default async function OfflinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/offline");
  const recentRecords = await prisma.offlineSyncRecord.findMany({
    where: { actorUserId: user.id },
    orderBy: { processedAt: "desc" },
    take: 10,
  });
  const openConflictCount = await prisma.offlineSyncRecord.count({
    where: { status: { in: ["FAILED", "CONFLICT"] }, resolutionStatus: "OPEN" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offline Queue"
        description="Local queue for test notes, serialized asset moves, and asset photo uploads. Sync applies actions only after server-side permission, asset state, and validation checks."
        action={
          <PageActions>
            <ActionLink href="/offline/conflicts" variant={openConflictCount ? "primary" : "secondary"}>
              Review conflicts ({openConflictCount})
            </ActionLink>
          </PageActions>
        }
      />
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Conflicts are actions the server refused to apply until reviewed.</p>
        <p className="mt-1">Retry runs the same validation again; cancel and mark reviewed keep an audit trail without applying the queued action.</p>
      </section>
      <OfflineQueuePanel userId={user.id} appVersion="0.1.0" />
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-950">Recent server sync records</h2>
        <p className="mt-1 text-sm text-slate-600">These are sanitized records created after local queued actions sync to the server.</p>
        <div className="mt-4 divide-y divide-slate-100">
          {recentRecords.map((record) => (
            <div key={record.id} className="py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{record.actionType} / {record.status}</p>
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
