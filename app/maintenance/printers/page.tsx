import { Printer, Wrench } from "lucide-react";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions } from "@/components/ui-patterns";
import { maintenanceTypeLabels } from "@/lib/constants";
import { buildMaintenanceSummary, maintenanceResultLabels, maintenanceStatusLabel, maintenanceStatusTone, summarizeMaintenanceReview } from "@/lib/maintenance";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PrinterMaintenancePage() {
  if (!(await hasPagePermission("inventory.read"))) return <ForbiddenPanel message="Printer maintenance requires inventory access." />;
  const printers = await prisma.device.findMany({
    where: { category: { in: ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER"] } },
    include: { maintenanceRecords: { include: { stockItem: true }, orderBy: { performedAt: "desc" }, take: 10 } },
    orderBy: [{ maintenanceDueAt: "asc" }, { name: "asc" }],
  });
  const review = summarizeMaintenanceReview(printers);
  return (
    <div className="space-y-6">
      <PageHeader title="Printer Maintenance" description="Manual printer cleaning, test print, parts replacement, and follow-up tracking. No printer commands are sent." action={<PageActions><ActionLink href="/maintenance">Back to Maintenance</ActionLink><ActionLink href="/reports/maintenance">Report</ActionLink></PageActions>} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Printer size={18} />} label="Printers" value={printers.length} helper="Thermal, MFP, and other printers" />
        <Metric icon={<Wrench size={18} />} label="No history" value={review.printersMissingHistory.length} helper="Need first maintenance record" />
        <Metric icon={<Wrench size={18} />} label="Overdue" value={review.overdue.length} helper={`${review.dueSoon.length} due soon`} />
        <Metric icon={<Wrench size={18} />} label="Failed / follow-up" value={review.failedNeedsFollowUp.length} helper="Create task if needed" />
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        {printers.map((asset) => <MaintenanceDeviceCard key={asset.id} asset={asset} />)}
        {!printers.length ? <EmptyState title="No printers found" description="Printer-category assets will appear here." /> : null}
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
          <p className="mt-1 text-sm text-slate-500">Next due: {summary.nextDueAt ? summary.nextDueAt.toLocaleDateString() : "No schedule"}</p>
          {latest ? <p className="mt-1 text-sm text-slate-500">Last: {maintenanceTypeLabels[latest.maintenanceType]} / {maintenanceResultLabels[latest.result]}</p> : <p className="mt-1 text-sm text-amber-700">No maintenance history yet.</p>}
        </div>
        <div className="grid gap-2 sm:min-w-44">
          <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
          <ActionLink href={`/devices/${asset.id}/maintenance/new`}>Add record</ActionLink>
          <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Printer maintenance: ${asset.name}`)}&category=MAINTENANCE&relatedDeviceId=${asset.id}`}>Create task</ActionLink>
        </div>
      </div>
    </MobileCard>
  );
}

function Metric({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: number; helper: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-slate-600">{icon}<p className="text-sm font-semibold">{label}</p></div><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{helper}</p></div>;
}
