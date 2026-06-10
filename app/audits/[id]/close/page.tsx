import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AuditCloseActions } from "@/components/audit-close-actions";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { auditProgress, auditScopeLabel } from "@/lib/audits";
import { hasPagePermission } from "@/lib/page-permissions";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AuditClosePage({ params }: Props) {
  if (!(await hasPagePermission("audits.write"))) return <ForbiddenPanel message="Closing physical audits requires Auditor, IT Staff, or Admin access." />;
  const { id } = await params;
  const audit = await prisma.inventoryAuditSession.findUnique({
    where: { id },
    include: { expectedItems: true, scans: true },
  });
  if (!audit) notFound();
  const progress = auditProgress(audit.expectedItems, audit.scans);
  const unresolved = progress.remaining + progress.wrongArea + progress.unknown + progress.needsReview;

  return (
    <div className="space-y-6">
      <PageHeader title="Close Audit" description={`${audit.title} · ${auditScopeLabel(audit)}`} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Expected" value={progress.expected} />
        <Metric label="Found" value={progress.found} />
        <Metric label="Missing if closed" value={progress.remaining} />
        <Metric label="Unresolved" value={unresolved} />
        <Metric label="Wrong area" value={progress.wrongArea} />
        <Metric label="Unknown" value={progress.unknown} />
        <Metric label="Duplicate" value={progress.duplicates} />
        <Metric label="Needs review" value={progress.needsReview} />
      </section>
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        Closing only updates audit records. Pending expected assets become missing for this audit record, but Device location/status/assignment/loan/RMA data is not changed.
      </section>
      <AuditCloseActions auditId={audit.id} unresolvedCount={unresolved} />
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
