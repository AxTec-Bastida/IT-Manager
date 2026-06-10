import Link from "next/link";
import { AlertCircle, ClipboardList, ExternalLink, SlidersHorizontal } from "lucide-react";
import { AlertSeverity, AlertSource, AlertStatus, AlertType, type Alert } from "@prisma/client";
import type React from "react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { AlertActions } from "@/components/alert-actions";
import { RefreshAlertsButton } from "@/components/refresh-alerts-button";
import { alertStatusLabels, alertTypeLabels, severityTone } from "@/lib/constants";
import { alertFilterHref, alertSourceLabel, buildActiveAlertFilters, formatAlertTextForUi, visibleAlertSourceOptions } from "@/lib/alert-ui";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const statusFilters: Array<{ label: string; value: AlertStatus }> = [
  { label: "Open", value: "OPEN" },
  { label: "Acknowledged", value: "ACKNOWLEDGED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Ignored", value: "IGNORED" },
];

const quickFilters: Array<{ label: string; params: Record<string, string> }> = [
  { label: "Stock", params: { source: "STOCK" } },
  { label: "Printer", params: { source: "PRINTER" } },
  { label: "RMA", params: { type: "RMA_FOLLOW_UP_DUE" } },
  { label: "Asset Loans", params: { type: "ASSET_LOAN_OVERDUE" } },
  { label: "Stock Loans", params: { type: "STOCK_LOAN_OVERDUE" } },
  { label: "Warranty", params: { source: "WARRANTY" } },
  { label: "Data Quality", params: { type: "DATA_INTEGRITY_WARNING" } },
  { label: "Inventory", params: { source: "IPAM" } },
];

export default async function AlertsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "OPEN";
  const severity = typeof params.severity === "string" ? params.severity : "";
  const type = typeof params.type === "string" ? params.type : "";
  const source = typeof params.source === "string" ? params.source : "";
  const assetId = typeof params.assetId === "string" ? params.assetId : "";

  const [alerts, statusCounts, dueCount] = await Promise.all([
    prisma.alert.findMany({
      where: {
        ...(status ? { status: status as AlertStatus } : {}),
        ...(severity ? { severity: severity as AlertSeverity } : {}),
        ...(type ? { type: type as AlertType } : {}),
        ...(source ? { source: source as AlertSource } : {}),
        ...(assetId ? { assetId } : {}),
      },
      include: { asset: true, stockItem: true },
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      take: 250,
    }),
    prisma.alert.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.alert.count({
      where: {
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        type: { in: ["RMA_FOLLOW_UP_DUE", "RMA_ACTIVE_REMINDER", "RMA_OVERDUE", "ASSET_LOAN_OVERDUE", "STOCK_LOAN_OVERDUE", "THERMAL_CLEANING_DUE", "THERMAL_MAINTENANCE_DUE", "WARRANTY_EXPIRING", "FACTURA_WARRANTY_EXPIRING"] },
      },
    }),
  ]);

  const counts = Object.fromEntries(statusCounts.map((entry) => [entry.status, entry._count._all])) as Partial<Record<AlertStatus, number>>;
  const activeFilters = buildActiveAlertFilters({ status, severity, source, type, assetId });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Alerts"
        description="Operational alerts for stock, maintenance, warranties, loans, RMA, data quality, and inventory issues."
        action={<RefreshAlertsButton />}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Open alerts" value={counts.OPEN ?? 0} tone="border-rose-200 bg-rose-50 text-rose-900" />
        <SummaryCard label="Acknowledged" value={counts.ACKNOWLEDGED ?? 0} tone="border-amber-200 bg-amber-50 text-amber-900" />
        <SummaryCard label="Due / overdue" value={dueCount} tone="border-violet-200 bg-violet-50 text-violet-900" />
        <SummaryCard label="Resolved / ignored" value={(counts.RESOLVED ?? 0) + (counts.IGNORED ?? 0)} tone="border-slate-200 bg-white text-slate-900" />
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <FilterChip key={filter.value} href={alertFilterHref({ status: filter.value })} active={status === filter.value && !severity && !source && !type && !assetId}>
              {filter.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((filter) => {
            const currentFilters: Record<string, string> = { status, severity, source, type, assetId };
            const active = Object.entries(filter.params).every(([key, value]) => currentFilters[key] === value);
            return (
              <FilterChip key={filter.label} href={alertFilterHref({ status, ...filter.params })} active={active}>
                {filter.label}
              </FilterChip>
            );
          })}
        </div>
        {activeFilters.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {activeFilters.map((filter) => <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filter}</span>)}
            <Link href="/alerts" className="inline-flex min-h-9 items-center rounded-full bg-slate-950 px-3 text-xs font-semibold text-white">Clear filters</Link>
          </div>
        ) : null}
        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Advanced filters</span>
            <span className="text-xs text-slate-500">{activeFilters.length ? `${activeFilters.length} active filters` : "Default: open alerts"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-5">
            <select name="status" form="alert-filter-form" defaultValue={status} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All statuses</option>
              {Object.values(AlertStatus).map((value) => <option key={value} value={value}>{alertStatusLabels[value]}</option>)}
            </select>
            <select name="severity" form="alert-filter-form" defaultValue={severity} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All severity</option>
              {Object.values(AlertSeverity).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="source" form="alert-filter-form" defaultValue={source} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All sources</option>
              {visibleAlertSourceOptions(source).map((value) => <option key={value} value={value}>{alertSourceLabel(value)}</option>)}
            </select>
            <select name="type" form="alert-filter-form" defaultValue={type} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base sm:text-sm">
              <option value="">All types</option>
              {Object.values(AlertType).map((value) => <option key={value} value={value}>{alertTypeLabels[value]}</option>)}
            </select>
            {assetId ? <input form="alert-filter-form" name="assetId" type="hidden" value={assetId} /> : null}
            <button form="alert-filter-form" className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Apply</button>
          </div>
        </details>
        <form id="alert-filter-form" />
      </section>

      <section className="grid gap-3">
        {alerts.map((alert) => {
          const related = relatedRecord(alert);
          return (
            <article key={alert.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={severityTone[alert.severity]}>{alert.severity}</Badge>
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{alertStatusLabels[alert.status]}</Badge>
                    <Badge className="bg-blue-100 text-blue-800 ring-blue-200">{alertTypeLabels[alert.type]}</Badge>
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-slate-950">{alert.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{formatAlertTextForUi(alert.message)}</p>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <InfoBlock label="Related record" value={related.label} />
                  <InfoBlock label="First seen" value={alert.firstSeenAt.toLocaleString()} />
                  <InfoBlock label="Last seen" value={alert.lastSeenAt.toLocaleString()} />
                  <InfoBlock label="Source" value={alertSourceLabel(alert.source)} />
                </div>

                {alert.resolutionNote ? <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Note: {alert.resolutionNote}</p> : null}

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {related.href ? (
                    <Link href={related.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                      <ExternalLink size={16} />
                      {related.action}
                    </Link>
                  ) : null}
                  <Link href={taskHref(alert, related.href)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <ClipboardList size={16} />
                    Create task
                  </Link>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <AlertActions alertId={alert.id} status={alert.status} />
                </div>
              </div>
            </article>
          );
        })}
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            <AlertCircle className="mx-auto mb-2 text-slate-400" size={24} />
            <p className="font-semibold text-slate-700">{status === "OPEN" && !severity && !source && !type && !assetId ? "No open alerts. Everything looks clear." : "No alerts found for this filter."}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href="/alerts" className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100">Clear filters</Link>
              <div className="flex justify-center"><RefreshAlertsButton /></div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
      {children}
    </Link>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-950">{value}</p>
    </div>
  );
}

type AlertWithRelations = Alert & {
  asset: { id: string; name: string; assetTag: string | null } | null;
  stockItem: { id: string; name: string; sku: string | null } | null;
};

function relatedRecord(alert: AlertWithRelations) {
  const metadata = parseMetadata(alert.metadata);
  if (alert.assetId) return { label: alert.asset ? `${alert.asset.assetTag ? `${alert.asset.assetTag} / ` : ""}${alert.asset.name}` : "Linked asset", href: `/devices/${alert.assetId}`, action: "Open asset" };
  if (alert.stockItemId) return { label: alert.stockItem ? `${alert.stockItem.sku ? `${alert.stockItem.sku} / ` : ""}${alert.stockItem.name}` : "Linked stock item", href: `/stock/${alert.stockItemId}`, action: "Open stock item" };
  if (metadata.rmaCaseId) return { label: metadata.rmaNumber ? `RMA ${metadata.rmaNumber}` : "Linked RMA", href: `/rma/${metadata.rmaCaseId}`, action: "Open RMA" };
  if (metadata.assetLoanId) return { label: metadata.loanNumber ? `Loan ${metadata.loanNumber}` : "Linked asset loan", href: `/loans/${metadata.assetLoanId}`, action: "Open loan" };
  if (metadata.stockIssueId) return { label: metadata.issueNumber ? `Stock issue ${metadata.issueNumber}` : "Linked stock loan", href: `/stock/issues/${metadata.stockIssueId}`, action: "Open stock issue" };
  if (alert.type === "DATA_INTEGRITY_WARNING") return { label: "Data Quality", href: "/data-quality", action: "Open data quality" };
  return { label: "No linked record", href: "", action: "Open record" };
}

function taskHref(alert: AlertWithRelations, relatedHref: string) {
  const notes = [
    formatAlertTextForUi(alert.message),
    `Alert type: ${alertTypeLabels[alert.type]}`,
    `Source: ${alertSourceLabel(alert.source)}`,
    relatedHref ? `Related: ${relatedHref}` : null,
    `First seen: ${alert.firstSeenAt.toLocaleString()}`,
    `Last seen: ${alert.lastSeenAt.toLocaleString()}`,
  ].filter(Boolean).join("\n");
  return `/tasks/new?${new URLSearchParams({
    relatedAlertId: alert.id,
    ...(alert.assetId ? { relatedDeviceId: alert.assetId } : {}),
    ...(alert.stockItemId ? { relatedStockItemId: alert.stockItemId } : {}),
    category: "ALERT",
    title: `Review: ${alert.title}`,
    notes,
  }).toString()}`;
}

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}
