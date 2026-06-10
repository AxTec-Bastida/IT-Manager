import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ActionLink, PageActions } from "@/components/ui-patterns";
import { AuditScanForm } from "@/components/audit-scan-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { auditProgress, auditScopeLabel } from "@/lib/audits";
import { hasPagePermission } from "@/lib/page-permissions";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AuditScanPage({ params }: Props) {
  if (!(await hasPagePermission("audits.write"))) return <ForbiddenPanel message="Scanning physical audits requires Auditor, IT Staff, or Admin access." />;
  const { id } = await params;
  const audit = await prisma.inventoryAuditSession.findUnique({
    where: { id },
  });
  if (!audit) notFound();
  const [expectedItems, scansForProgress, latestScans] = await Promise.all([
    prisma.inventoryAuditExpectedItem.findMany({
      where: { auditSessionId: audit.id },
      select: { resultStatus: true },
    }),
    prisma.inventoryAuditScan.findMany({
      where: { auditSessionId: audit.id },
      select: { resultType: true },
    }),
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
        title="Scan Audit"
        description={`${audit.title} · ${auditScopeLabel(audit)}`}
        action={
          <PageActions>
            <ActionLink href={`/audits/${audit.id}/review`}>
              <ClipboardList size={16} />
              Review
            </ActionLink>
          </PageActions>
        }
      />
      {audit.status !== "ACTIVE" ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          This audit is {audit.status.replaceAll("_", " ").toLowerCase()} and no longer accepts scans. <Link href={`/audits/${audit.id}/review`} className="font-semibold underline">Open review</Link>.
        </section>
      ) : (
        <AuditScanForm auditId={audit.id} initialProgress={progress} />
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-950">Last scans</h2>
        <div className="grid gap-3">
          {latestScans.map((scan) => (
            <article key={scan.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-slate-950">{scan.matchedDevice?.name || scan.scannedValue}</p>
                  <p className="break-all font-mono text-sm text-slate-600">{scan.scannedValue}</p>
                  {scan.notes ? <p className="mt-1 text-sm text-slate-500">{scan.notes}</p> : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{scan.resultType.replaceAll("_", " ")}</span>
              </div>
            </article>
          ))}
          {!latestScans.length ? <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No scans yet. Scan the first asset label above.</p> : null}
        </div>
      </section>
    </div>
  );
}
