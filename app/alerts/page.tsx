import Link from "next/link";
import { AlertTriangle, MapPin, SlidersHorizontal } from "lucide-react";
import { AlertSeverity, AlertSource, AlertStatus, AlertType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { AlertActions } from "@/components/alert-actions";
import { RefreshAlertsButton } from "@/components/refresh-alerts-button";
import { alertSourceLabels, alertStatusLabels, alertTypeLabels, severityTone } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "OPEN";
  const severity = typeof params.severity === "string" ? params.severity : "";
  const type = typeof params.type === "string" ? params.type : "";
  const source = typeof params.source === "string" ? params.source : "";
  const assetId = typeof params.assetId === "string" ? params.assetId : "";
  const alerts = await prisma.alert.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(severity ? { severity: severity as never } : {}),
      ...(type ? { type: type as never } : {}),
      ...(source ? { source: source as never } : {}),
      ...(assetId ? { assetId } : {}),
    },
    include: { asset: true, stockItem: true },
    orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
    take: 250,
  });
  const assets = await prisma.device.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, assetTag: true } });
  const activeFilters = [
    status ? alertStatusLabels[status as AlertStatus] : null,
    severity ? `Severity: ${severity}` : null,
    source ? alertSourceLabels[source as AlertSource] : null,
    type ? alertTypeLabels[type as AlertType] : null,
    assetId ? "Asset selected" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts" description="Operational alert center for IPAM, stock, printer maintenance, warranties, missing assets, and fixed asset movement." action={<RefreshAlertsButton />} />

      <form className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
        {activeFilters.length ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filter}</span>)}
            <Link href="/alerts" className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">Clear</Link>
          </div>
        ) : null}
        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Filters</span>
            <span className="text-xs text-slate-500">{activeFilters.length ? `${activeFilters.length} active` : "Open alerts"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-3 xl:grid-cols-6">
            <select name="status" defaultValue={status} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All statuses</option>
              {Object.values(AlertStatus).map((value) => <option key={value} value={value}>{alertStatusLabels[value]}</option>)}
            </select>
            <select name="severity" defaultValue={severity} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All severity</option>
              {Object.values(AlertSeverity).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="source" defaultValue={source} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All sources</option>
              {Object.values(AlertSource).map((value) => <option key={value} value={value}>{alertSourceLabels[value]}</option>)}
            </select>
            <select name="type" defaultValue={type} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All types</option>
              {Object.values(AlertType).map((value) => <option key={value} value={value}>{alertTypeLabels[value]}</option>)}
            </select>
            <select name="assetId" defaultValue={assetId} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All assets</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag ? `${asset.assetTag} - ` : ""}{asset.name}</option>)}
            </select>
            <button className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Apply</button>
          </div>
        </details>
      </form>

      <section className="grid gap-3">
        {alerts.map((alert) => (
          <article key={alert.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={severityTone[alert.severity]}>{alert.severity}</Badge>
                  <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{alertStatusLabels[alert.status]}</Badge>
                  <Badge className="bg-blue-100 text-blue-800 ring-blue-200">{alertSourceLabels[alert.source]}</Badge>
                </div>
                <h2 className="mt-3 font-semibold text-slate-950">{alert.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                  <span>First: {alert.firstSeenAt.toLocaleString()}</span>
                  <span>Last: {alert.lastSeenAt.toLocaleString()}</span>
                  <span>Type: {alertTypeLabels[alert.type]}</span>
                  <span>{alert.asset ? `Asset: ${alert.asset.name}` : alert.stockItem ? `Stock: ${alert.stockItem.name}` : "No linked record"}</span>
                </div>
                {alert.resolutionNote ? <p className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-600">{alert.resolutionNote}</p> : null}
                <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                  {alert.assetId ? <Link href={`/devices/${alert.assetId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><AlertTriangle size={16} />Open asset</Link> : null}
                  {alert.assetId && ["MOVEMENT", "MISSING_ASSET", "UNIFI"].includes(alert.source) ? <Link href={`/map?asset=${alert.assetId}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><MapPin size={16} />Open map</Link> : null}
                </div>
              </div>
              <AlertActions alertId={alert.id} />
            </div>
          </article>
        ))}
        {alerts.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No alerts match this view.</p> : null}
      </section>
    </div>
  );
}
