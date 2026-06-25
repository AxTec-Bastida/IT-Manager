import { Scale, Wrench } from "lucide-react";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions } from "@/components/ui-patterns";
import { maintenanceTypeLabels } from "@/lib/constants";
import { buildMaintenanceSummary, maintenanceResultLabels, maintenanceStatusLabel, maintenanceStatusTone, summarizeMaintenanceReview } from "@/lib/maintenance";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ScaleMaintenancePage() {
  if (!(await hasPagePermission("inventory.read"))) return <ForbiddenPanel message="Scale maintenance requires inventory access." />;
  const scales = await prisma.device.findMany({
    where: { category: "SCALE" },
    include: { maintenanceRecords: { include: { stockItem: true }, orderBy: { performedAt: "desc" }, take: 10 } },
    orderBy: [{ maintenanceDueAt: "asc" }, { name: "asc" }],
  });
  const review = summarizeMaintenanceReview(scales);
  return (
    <div className="space-y-6">
      <PageHeader title="Scale Maintenance" description="Manual calibration checks, weight tests, display checks, cleaning, and follow-up tracking. Active scales use the active maintenance interval. Stock or spare scales use a longer interval. Retired/decommissioned scales are excluded. No scale polling is performed." action={<PageActions><ActionLink href="/maintenance">Back to Maintenance</ActionLink><ActionLink href="/reports/maintenance">Report</ActionLink></PageActions>} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Scale size={18} />} label="Scales" value={review.scales.length} helper={`${review.excluded.length} excluded retired/decommissioned`} />
        <Metric icon={<Wrench size={18} />} label="No checks" value={review.scalesMissingHistory.length} helper="Need first calibration/check" />
        <Metric icon={<Wrench size={18} />} label="Overdue" value={review.overdue.length} helper={`${review.dueSoon.length} due soon`} />
        <Metric icon={<Wrench size={18} />} label="Failed / follow-up" value={review.failedNeedsFollowUp.length} helper="Create task if needed" />
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        {scales.map((asset) => <MaintenanceDeviceCard key={asset.id} asset={asset} />)}
        {!scales.length ? <EmptyState title="No scales found" description="Scale-category assets will appear here." /> : null}
      </section>
    </div>
  );
}

function MaintenanceDeviceCard({ asset }: { asset: Awaited<ReturnType<typeof prisma.device.findMany>>[number] }) {
  const summary = buildMaintenanceSummary(asset);
  const latest = summary.latest;
  return (
    <MobileCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge className={maintenanceStatusTone(summary.status)}>{maintenanceStatusLabel(summary.status)}</Badge>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{asset.name}</h2>
          <p className="text-sm text-slate-600">{asset.assetTag || "No tag"} / {asset.location || asset.areaDepartment || "No location"}</p>
          <p className="mt-1 text-sm text-slate-500">{summary.profile.label}: {summary.profile.explanation}</p>
          <p className="mt-1 text-sm text-slate-500">Next due: {summary.nextDueAt ? summary.nextDueAt.toLocaleDateString() : "No schedule"}</p>
          {latest ? <p className="mt-1 text-sm text-slate-500">Last: {maintenanceTypeLabels[latest.maintenanceType]} / {maintenanceResultLabels[latest.result]}</p> : <p className="mt-1 text-sm text-amber-700">No calibration/check history yet.</p>}
          {latest?.testWeight || latest?.measuredValue ? <p className="mt-1 text-sm text-slate-500">Weight: {latest.testWeight || "-"} / measured {latest.measuredValue || "-"}</p> : null}
        </div>
        <div className="grid gap-2 sm:min-w-44">
          <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
          <ActionLink href={`/devices/${asset.id}/maintenance/new`}>Add check</ActionLink>
          <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Scale calibration: ${asset.name}`)}&category=MAINTENANCE&relatedDeviceId=${asset.id}`}>Create task</ActionLink>
        </div>
      </div>
    </MobileCard>
  );
}

function Metric({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: number; helper: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-slate-600">{icon}<p className="text-sm font-semibold">{label}</p></div><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{helper}</p></div>;
}
