import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Download, ScanLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ActionLink, PageActions } from "@/components/ui-patterns";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { auditProgress, auditScopeLabel } from "@/lib/audits";
import { hasPagePermission } from "@/lib/page-permissions";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AuditDetailPage({ params }: Props) {
  if (!(await hasPagePermission("audits.read"))) return <ForbiddenPanel message="Viewing audit details requires Auditor, IT Staff, or Admin access." />;
  const { id } = await params;
  const audit = await prisma.inventoryAuditSession.findUnique({ where: { id } });
  if (!audit) notFound();
  const [expectedItems, scansForProgress, latestScans] = await Promise.all([
    prisma.inventoryAuditExpectedItem.findMany({ where: { auditSessionId: audit.id }, select: { resultStatus: true } }),
    prisma.inventoryAuditScan.findMany({ where: { auditSessionId: audit.id }, select: { resultType: true } }),
    prisma.inventoryAuditScan.findMany({
      where: { auditSessionId: audit.id },
      include: { matchedDevice: { select: { id: true, name: true } } },
      orderBy: { scannedAt: "desc" },
      take: 10,
    }),
  ]);
  const progress = auditProgress(expectedItems, scansForProgress);

  return (
    <div className="space-y-6">
      <PageHeader
        title={audit.title}
        description={`${audit.auditNumber || "Audit"} · ${auditScopeLabel(audit)} · ${audit.status.replaceAll("_", " ")}`}
        action={
          <PageActions>
            {audit.status === "ACTIVE" ? (
              <ActionLink href={`/audits/${audit.id}/scan`} variant="primary">
                <ScanLine size={16} />
                Scan
              </ActionLink>
            ) : null}
            <ActionLink href={`/audits/${audit.id}/review`}>
              <ClipboardList size={16} />
              Review
            </ActionLink>
          </PageActions>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Expected" value={progress.expected} />
        <Metric label="Found" value={progress.found} />
        <Metric label="Missing" value={progress.missing || progress.remaining} />
        <Metric label="Wrong area" value={progress.wrongArea} />
        <Metric label="Unknown labels" value={progress.unknown} />
        <Metric label="Duplicates" value={progress.duplicates} />
        <Metric label="Needs review" value={progress.needsReview} />
        <Metric label="Status" value={audit.status.replaceAll("_", " ")} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Exports</h2>
            <p className="mt-1 text-sm text-slate-600">Download audit results as CSV. Exports do not change asset status or location.</p>
          </div>
          <ActionLink href={`/audits/${audit.id}/review`}>
            <ClipboardList size={16} />
            Review findings
          </ActionLink>
        </div>
        <ExportButtonGrid auditId={audit.id} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <InfoCard label="Started" value={audit.startedAt.toLocaleString()} />
        <InfoCard label="Completed" value={audit.completedAt ? audit.completedAt.toLocaleString() : "Not completed"} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-950">Safety</h2>
        <p className="mt-1 text-sm text-slate-600">This audit preserved expected/scanned records only. It did not move assets or change statuses automatically.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-950">Latest scans</h2>
        <div className="grid gap-3">
          {latestScans.map((scan) => (
            <article key={scan.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{scan.matchedDevice?.name || scan.scannedValue}</p>
                  <p className="font-mono text-sm text-slate-600">{scan.scannedValue}</p>
                  {scan.notes ? <p className="mt-1 text-sm text-slate-500">{scan.notes}</p> : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{scan.resultType.replaceAll("_", " ")}</span>
              </div>
              {scan.matchedDevice ? <Link href={`/devices/${scan.matchedDevice.id}`} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Open asset</Link> : null}
            </article>
          ))}
          {!latestScans.length ? <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No scans yet.</p> : null}
        </div>
      </section>
    </div>
  );
}

function ExportButtonGrid({ auditId }: { auditId: string }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <ExportLink href={`/api/audits/${auditId}/export/audit-summary`} label="Export Summary" />
      <ExportLink href={`/api/audits/${auditId}/export/audit-missing`} label="Export Missing" />
      <ExportLink href={`/api/audits/${auditId}/export/audit-wrong-area`} label="Export Wrong Area" />
      <ExportLink href={`/api/audits/${auditId}/export/audit-unknown-labels`} label="Export Unknown Labels" />
      <ExportLink href={`/api/audits/${auditId}/export/audit-all-findings`} label="Export All Findings" />
    </div>
  );
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
      <Download size={16} />
      {label}
    </Link>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
