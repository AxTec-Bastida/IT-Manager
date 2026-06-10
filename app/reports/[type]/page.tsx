import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions, SectionCard } from "@/components/ui-patterns";
import { canPerformAction, getCurrentUser } from "@/lib/auth";
import { getReportData, isReportType, reportPermission, type ReportMetric, type ReportRow, type ReportSection } from "@/lib/reports";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ type: string }>;
};

export default async function ReportDetailPage({ params }: PageProps) {
  const { type } = await params;
  if (!isReportType(type)) notFound();

  const user = await getCurrentUser();
  if (!user || !canPerformAction(user, reportPermission(type))) {
    return <ForbiddenPanel message="You do not have permission to view this report." />;
  }

  const report = await getReportData(type);

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.title}
        description={report.description}
        action={
          <PageActions>
            <ActionLink href="/reports">
              <ArrowLeft size={16} />
              Reports
            </ActionLink>
            <ActionLink href={report.primaryHref}>
              <ExternalLink size={16} />
              Source
            </ActionLink>
            <ActionLink href={report.exportHref} variant="primary">
              <Download size={16} />
              Export CSV
            </ActionLink>
          </PageActions>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {report.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div className="grid gap-4">
        {report.sections.map((section) => (
          <ReportSectionCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: ReportMetric }) {
  const content = (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-600">{metric.label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{metric.value}</p>
      {metric.helper ? <p className="mt-1 text-sm text-slate-500">{metric.helper}</p> : null}
    </div>
  );
  return metric.href ? <Link href={metric.href}>{content}</Link> : content;
}

function ReportSectionCard({ section }: { section: ReportSection }) {
  return (
    <SectionCard className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
        {section.description ? <p className="mt-1 text-sm text-slate-500">{section.description}</p> : null}
      </div>

      {section.rows.length ? (
        <>
          <div className="grid gap-3 lg:hidden">
            {section.rows.map((row, index) => (
              <ReportMobileRow key={`${row.label}-${index}`} row={row} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 lg:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {section.rows.map((row, index) => (
                  <tr key={`${row.label}-${index}`}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{row.label}</td>
                    <td className="px-4 py-3 text-slate-700">{row.value ?? ""}</td>
                    <td className="max-w-xl px-4 py-3 text-slate-600">{row.helper ?? ""}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.href ? <InlineLink href={row.href}>Open</InlineLink> : null}
                        {row.actionHref ? <InlineLink href={row.actionHref}>Action</InlineLink> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState title={section.emptyText ?? "No rows to show"} />
      )}
    </SectionCard>
  );
}

function ReportMobileRow({ row }: { row: ReportRow }) {
  return (
    <MobileCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{row.label}</h3>
          {row.value != null ? <p className="mt-1 text-2xl font-semibold text-slate-800">{row.value}</p> : null}
          {row.helper ? <p className="mt-2 text-sm text-slate-600">{row.helper}</p> : null}
          {row.badges?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {row.badges.map((badge) => (
                <Badge key={badge} className="bg-slate-100 text-slate-700 ring-slate-200">{badge}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {row.href || row.actionHref ? (
        <div className="mt-4 grid gap-2 min-[360px]:grid-cols-2">
          {row.href ? <ActionLink href={row.href}>Open</ActionLink> : null}
          {row.actionHref ? (
            <ActionLink href={row.actionHref}>
              <ClipboardList size={16} />
              Action
            </ActionLink>
          ) : null}
        </div>
      ) : null}
    </MobileCard>
  );
}

function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
      {children}
    </Link>
  );
}
