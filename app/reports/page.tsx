import Link from "next/link";
import { BarChart3, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions } from "@/components/ui-patterns";
import { canPerformAction, getCurrentUser } from "@/lib/auth";
import { getReportsHubData, reportDefinitions, reportPermission, reportTypes, type ReportType } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) return <ForbiddenPanel message="Sign in to view operational reports." />;

  const allowedTypes = reportTypes.filter((type) => canPerformAction(user, reportPermission(type)));
  if (!allowedTypes.length) return <ForbiddenPanel message="You do not have permission to view reports." />;

  const reports = await getReportsHubData(allowedTypes);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Lightweight operational summaries for inventory, assignments, loans, stockroom, audits, RMA, warranties, and IT work. Use exports for CSV review without loading giant tables."
        action={
          <PageActions>
            <ActionLink href="/devices">Inventory</ActionLink>
            <ActionLink href="/data-quality">Data Quality</ActionLink>
          </PageActions>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <ReportCard key={report.type} type={report.type} title={report.definition.shortTitle} description={report.definition.description} metrics={report.preview} />
        ))}
      </section>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Reports Lite is intentionally summary-first: pages show key counts and recent or priority rows, while CSV exports include the same bounded summary sections. Sensitive values, notes, credentials, and configuration secrets are not included.
      </div>
    </div>
  );
}

function ReportCard({ type, title, description, metrics }: { type: ReportType; title: string; description: string; metrics: { label: string; value: string | number; helper?: string }[] }) {
  const definition = reportDefinitions[type];
  return (
    <MobileCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Reports Lite</Badge>
          <h2 className="mt-3 text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <BarChart3 className="shrink-0 text-slate-400" size={22} />
      </div>

      {metrics.length ? (
        <div className="grid gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{metric.value}</p>
              {metric.helper ? <p className="mt-1 text-xs text-slate-500">{metric.helper}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No summary yet" description="Open the report for current details." />
      )}

      <div className="mt-auto grid gap-2 sm:grid-cols-2">
        <ActionLink href={`/reports/${type}`} variant="primary">
          <ExternalLink size={16} />
          Open
        </ActionLink>
        <ActionLink href={`/api/reports/${type}/export`}>
          <Download size={16} />
          Export CSV
        </ActionLink>
      </div>
      <Link className="text-sm font-semibold text-slate-600 hover:text-slate-950" href={definition.primaryHref}>
        Open source workflow
      </Link>
    </MobileCard>
  );
}
