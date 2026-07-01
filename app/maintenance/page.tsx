import Link from "next/link";
import { AlertTriangle, History, Printer, Scale, Wrench, Scan, Smartphone } from "lucide-react";
import { Badge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions } from "@/components/ui-patterns";
import { categoryLabels, maintenanceTypeLabels } from "@/lib/constants";
import { buildMaintenanceSummary, maintenanceResultLabels, maintenanceStatusLabel, maintenanceStatusTone, summarizeMaintenanceReview, supportsMaintenanceFocus } from "@/lib/maintenance";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";
import { ForbiddenPanel } from "@/components/forbidden-panel";

export const dynamic = "force-dynamic";

export default async function MaintenanceHubPage() {
  if (!(await hasPagePermission("inventory.read"))) return <ForbiddenPanel message="Maintenance history requires inventory access." />;
  const [rawAssets, recent, openTasks] = await Promise.all([
    prisma.device.findMany({
      where: { category: { in: ["THERMAL_PRINTER", "MFP_PRINTER", "OTHER_PRINTER", "SCALE", "SCANNER", "OTHER"] } },
      include: { maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 10 } },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.maintenanceRecord.findMany({ include: { asset: true, stockItem: true }, orderBy: { performedAt: "desc" }, take: 8 }),
    prisma.task.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, category: { in: ["MAINTENANCE", "REPAIR_RMA", "ASSET_FOLLOW_UP"] } }, include: { relatedDevice: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 8 }),
  ]);
  const assets = rawAssets.filter(supportsMaintenanceFocus);
  const review = summarizeMaintenanceReview(assets);
  const failed = review.failedNeedsFollowUp;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Manual printer and scale cleaning, calibration, page counts, consumables, evidence, and follow-up tracking. Active equipment uses shorter intervals; stock/spare equipment uses longer intervals; retired and decommissioned assets are excluded."
        action={
          <PageActions>
            <ActionLink href="/maintenance/printers"><Printer size={16} />Printers</ActionLink>
            <ActionLink href="/maintenance/scales"><Scale size={16} />Scales</ActionLink>
          </PageActions>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <SummaryCard icon={<Printer size={18} />} label="Printers" value={review.printers.length} helper={`${review.printersMissingHistory.length} no history`} href="/maintenance/printers" />
        <SummaryCard icon={<Scale size={18} />} label="Scales" value={review.scales.length} helper={`${review.scalesMissingHistory.length} no checks`} href="/maintenance/scales" />
        <SummaryCard icon={<Scan size={18} />} label="Scanners" value={review.scanners.length} helper={`${review.scannersMissingHistory.length} no checks`} />
        <SummaryCard icon={<Smartphone size={18} />} label="Sleds" value={review.sleds.length} helper={`${review.sledsMissingHistory.length} no checks`} />
        <SummaryCard icon={<AlertTriangle size={18} />} label="Overdue" value={review.overdue.length} helper={`${review.dueSoon.length} due soon`} tone={review.overdue.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"} />
        <SummaryCard icon={<AlertTriangle size={18} />} label="No Schedule" value={review.noSchedule.length} helper="Needs due date" tone={review.noSchedule.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"} />
        <SummaryCard icon={<Wrench size={18} />} label="Excluded" value={review.excluded.length} helper="Retired/disposed" />
        <SummaryCard icon={<Wrench size={18} />} label="Open Tasks" value={openTasks.length} helper="Follow-ups" href="/tasks?category=MAINTENANCE" />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Panel title="Due / Overdue Equipment" action={<ActionLink href="/tasks/new?title=Review%20maintenance%20overdue&category=MAINTENANCE">Create task</ActionLink>}>
          {review.overdue.concat(review.dueSoon).slice(0, 10).map((asset) => <MaintenanceAssetCard key={asset.id} asset={asset} />)}
          {!review.overdue.length && !review.dueSoon.length ? <EmptyState title="Nothing due soon" description="Printers and scales with schedules are currently clear." /> : null}
        </Panel>
        <Panel title="Missing Schedule / Baseline" action={<ActionLink href="/data-quality">Data Quality</ActionLink>}>
          {review.noSchedule.slice(0, 10).map((asset) => <MaintenanceAssetCard key={asset.id} asset={asset} />)}
          {!review.noSchedule.length ? <EmptyState title="All focused assets have schedules" description="Printer and scale due dates are populated where maintenance tracking is active." /> : null}
        </Panel>
        <Panel title="Failed / Needs Follow-up">
          {failed.slice(0, 10).map(({ asset, record }) => (
            <MobileCard key={record.id} className="border-amber-200 bg-amber-50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-800">{maintenanceResultLabels[record.result]}</p>
                  <h3 className="font-semibold text-slate-950">{asset.name}</h3>
                  <p className="text-sm text-slate-600">{maintenanceTypeLabels[record.maintenanceType]} / {new Date(record.performedAt).toLocaleDateString()}</p>
                  {record.notes ? <p className="mt-1 text-sm text-slate-600">{record.notes}</p> : null}
                </div>
                <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Follow up maintenance: ${asset.name}`)}&category=MAINTENANCE&relatedDeviceId=${asset.id}`}>Create task</ActionLink>
              </div>
            </MobileCard>
          ))}
          {!failed.length ? <EmptyState title="No failed maintenance records" description="No Fail or Needs follow-up records are currently listed." /> : null}
        </Panel>
      </section>

      <Panel title="Recently Serviced" action={<ActionLink href="/reports/maintenance"><History size={16} />Maintenance report</ActionLink>}>
        {recent.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {recent.map((record) => (
              <MobileCard key={record.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{maintenanceTypeLabels[record.maintenanceType]}</p>
                    <h3 className="font-semibold text-slate-950">{record.asset.name}</h3>
                    <p className="text-sm text-slate-600">{record.performedBy || "No technician"} / {record.performedAt.toLocaleString()}</p>
                    <p className="text-sm text-slate-500">{maintenanceResultLabels[record.result]}</p>
                  </div>
                  <ActionLink href={`/devices/${record.assetId}/maintenance`}>History</ActionLink>
                </div>
              </MobileCard>
            ))}
          </div>
        ) : <EmptyState title="No maintenance records yet" description="Add a record from a printer or scale asset detail page." />}
      </Panel>

      <Panel title="Open Maintenance Tasks">
        {openTasks.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {openTasks.map((task) => (
              <MobileCard key={task.id}>
                <h3 className="font-semibold text-slate-950">{task.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{task.relatedDevice?.name ?? "No asset linked"}{task.dueDate ? ` / due ${task.dueDate.toLocaleDateString()}` : ""}</p>
                <div className="mt-3"><ActionLink href={`/tasks/${task.id}`}>Open task</ActionLink></div>
              </MobileCard>
            ))}
          </div>
        ) : <EmptyState title="No open maintenance tasks" description="Create tasks from due or failed maintenance cards when follow-up is needed." />}
      </Panel>
    </div>
  );
}

function MaintenanceAssetCard({ asset }: { asset: Awaited<ReturnType<typeof prisma.device.findMany>>[number] }) {
  const summary = buildMaintenanceSummary(asset);
  return (
    <MobileCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge className={maintenanceStatusTone(summary.status)}>{maintenanceStatusLabel(summary.status)}</Badge>
          <h3 className="mt-2 font-semibold text-slate-950">{asset.name}</h3>
          <p className="text-sm text-slate-600">{asset.assetTag || "No tag"} / {categoryLabels[asset.category]}</p>
          <p className="text-sm text-slate-500">{summary.profile.label} / {summary.profile.intervalDays ? `${summary.profile.intervalDays} days` : "No recurring interval"}</p>
          <p className="text-sm text-slate-500">Next due: {summary.nextDueAt ? summary.nextDueAt.toLocaleDateString() : "No schedule"}</p>
        </div>
        <div className="grid gap-2 sm:min-w-40">
          <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
          <ActionLink href={`/devices/${asset.id}/maintenance/new`}>Add record</ActionLink>
        </div>
      </div>
    </MobileCard>
  );
}

function SummaryCard({ icon, label, value, helper, href, tone = "border-slate-200 bg-white" }: { icon: React.ReactNode; label: string; value: number | string; helper: string; href?: string; tone?: string }) {
  const content = <div className={`rounded-lg border p-4 shadow-sm ${tone}`}><div className="flex items-center gap-2 text-slate-600">{icon}<p className="text-sm font-semibold">{label}</p></div><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{helper}</p></div>;
  return href ? <Link href={href}>{content}</Link> : content;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold text-slate-950">{title}</h2>{action}</div><div className="grid gap-3">{children}</div></section>;
}
