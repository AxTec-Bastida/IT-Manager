import { notFound } from "next/navigation";
import { Camera, ClipboardList, Wrench } from "lucide-react";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions } from "@/components/ui-patterns";
import { maintenanceTypeLabels } from "@/lib/constants";
import { buildMaintenanceSummary, maintenanceResultLabels, maintenanceStatusLabel, maintenanceStatusTone } from "@/lib/maintenance";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DeviceMaintenanceHistoryPage({ params }: Props) {
  if (!(await hasPagePermission("inventory.read"))) return <ForbiddenPanel message="Maintenance history requires inventory access." />;
  const { id } = await params;
  const asset = await prisma.device.findUnique({
    where: { id },
    include: { maintenanceRecords: { include: { stockItem: true }, orderBy: { performedAt: "desc" } } },
  });
  if (!asset) notFound();
  const canWrite = await hasPagePermission("inventory.write");
  const summary = buildMaintenanceSummary(asset);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance History"
        description={`${asset.name}${asset.assetTag ? ` / ${asset.assetTag}` : ""}`}
        action={
          <PageActions>
            <ActionLink href={`/devices/${asset.id}`}>Open asset</ActionLink>
            {canWrite ? <ActionLink href={`/devices/${asset.id}/maintenance/new`} variant="primary"><Wrench size={16} />Add record</ActionLink> : null}
          </PageActions>
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Status" value={maintenanceStatusLabel(summary.status)} badgeClass={maintenanceStatusTone(summary.status)} />
          <Info label="Last maintenance" value={summary.lastMaintenanceAt ? summary.lastMaintenanceAt.toLocaleDateString() : "None"} />
          <Info label="Last result" value={summary.lastResult ? maintenanceResultLabels[summary.lastResult] : "-"} />
          <Info label="Next due" value={summary.nextDueAt ? summary.nextDueAt.toLocaleDateString() : "No schedule"} />
        </div>
        <div className="mt-4 grid gap-2 sm:flex">
          <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Maintenance follow-up: ${asset.name}`)}&category=MAINTENANCE&relatedDeviceId=${asset.id}`}><ClipboardList size={16} />Create task</ActionLink>
          <ActionLink href={`/devices/${asset.id}#photos`}><Camera size={16} />Add evidence photo</ActionLink>
        </div>
      </section>

      <section className="grid gap-3">
        {asset.maintenanceRecords.map((record) => (
          <MobileCard key={record.id} className={record.result === "FAIL" || record.result === "NEEDS_FOLLOW_UP" ? "border-amber-200 bg-amber-50" : undefined}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">{maintenanceTypeLabels[record.maintenanceType]}</p>
                <h2 className="text-lg font-semibold text-slate-950">{maintenanceResultLabels[record.result]}</h2>
                <p className="mt-1 text-sm text-slate-600">{record.performedAt.toLocaleString()} / {record.performedBy || "No technician"}</p>
                {record.resultDetails ? <p className="mt-1 text-sm text-slate-600">Result detail: {record.resultDetails}</p> : null}
                {record.testWeight || record.expectedValue || record.measuredValue ? <p className="mt-1 text-sm text-slate-600">Weight: {record.testWeight || "-"} / expected {record.expectedValue || "-"} / measured {record.measuredValue || "-"}</p> : null}
                {record.stockItem ? <p className="mt-1 text-sm text-slate-600">Part used: {record.quantityUsed ?? 0} {record.stockItem.name}</p> : null}
                {record.vendorTicket ? <p className="mt-1 text-sm text-slate-600">Vendor ticket: {record.vendorTicket}</p> : null}
                {record.notes ? <p className="mt-2 text-sm text-slate-700">{record.notes}</p> : null}
              </div>
              {record.result === "FAIL" || record.result === "NEEDS_FOLLOW_UP" ? <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Follow up ${maintenanceTypeLabels[record.maintenanceType]}: ${asset.name}`)}&category=MAINTENANCE&relatedDeviceId=${asset.id}`}>Create task</ActionLink> : null}
            </div>
          </MobileCard>
        ))}
        {!asset.maintenanceRecords.length ? <EmptyState title="No maintenance history yet" description="Add the first cleaning, test print, calibration check, repair, or parts replacement record." action={canWrite ? <ActionLink href={`/devices/${asset.id}/maintenance/new`}>Add record</ActionLink> : undefined} /> : null}
      </section>
    </div>
  );
}

function Info({ label, value, badgeClass }: { label: string; value: string; badgeClass?: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      {badgeClass ? <Badge className={`mt-1 ${badgeClass}`}>{value}</Badge> : <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>}
    </div>
  );
}
