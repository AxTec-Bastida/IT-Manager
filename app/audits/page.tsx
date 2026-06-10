import Link from "next/link";
import type { DeviceCategory, InventoryAuditExpectedResult, InventoryAuditScanResult, InventoryAuditScopeType, InventoryAuditSessionStatus } from "@prisma/client";
import { ClipboardCheck, Plus, ScanLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, PageActions } from "@/components/ui-patterns";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { auditProgress, auditScopeLabel } from "@/lib/audits";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  if (!(await hasPagePermission("audits.read"))) return <ForbiddenPanel message="Physical audit access requires Auditor, IT Staff, or Admin access." />;
  const audits = await prisma.inventoryAuditSession.findMany({
    orderBy: [{ startedAt: "desc" }],
    include: { expectedItems: true, scans: true },
    take: 50,
  });
  const active = audits.filter((audit) => ["ACTIVE", "REVIEW"].includes(audit.status));
  const recent = audits.filter((audit) => !["ACTIVE", "REVIEW"].includes(audit.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Physical Audits"
        description="Phone-first cycle counts for scanning an area, finding missing assets, and reviewing wrong-area or unknown labels."
        action={
          <PageActions>
            <ActionLink href="/audits/new" variant="primary">
              <Plus size={16} />
              New audit
            </ActionLink>
          </PageActions>
        }
      />

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-950">Active / review audits</h2>
        {active.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((audit) => <AuditCard key={audit.id} audit={audit} />)}
          </div>
        ) : (
          <EmptyState title="No active audits" description="Start a cycle count when you are ready to walk an area with a phone or scanner." action={<ActionLink href="/audits/new">Start audit</ActionLink>} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-950">Recent audits</h2>
        {recent.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((audit) => <AuditCard key={audit.id} audit={audit} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No closed audits yet.</div>
        )}
      </section>
    </div>
  );
}

type AuditCardAudit = {
  id: string;
  auditNumber: string | null;
  title: string;
  scopeType: InventoryAuditScopeType;
  area: string | null;
  department: string | null;
  location: string | null;
  category: DeviceCategory | null;
  status: InventoryAuditSessionStatus;
  expectedItems: Array<{ resultStatus: InventoryAuditExpectedResult }>;
  scans: Array<{ resultType: InventoryAuditScanResult }>;
};

function AuditCard({ audit }: { audit: AuditCardAudit }) {
  const progress = auditProgress(audit.expectedItems, audit.scans);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">{audit.auditNumber || "Audit"}</p>
          <h3 className="break-words font-semibold text-slate-950">{audit.title}</h3>
          <p className="text-sm text-slate-500">{auditScopeLabel(audit)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{audit.status.replaceAll("_", " ")}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <Metric label="Found" value={`${progress.found}/${progress.expected}`} />
        <Metric label="Wrong" value={progress.wrongArea} />
        <Metric label="Unknown" value={progress.unknown} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href={`/audits/${audit.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
          <ClipboardCheck size={16} />
          Open
        </Link>
        {audit.status === "ACTIVE" ? (
          <Link href={`/audits/${audit.id}/scan`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
            <ScanLine size={16} />
            Scan
          </Link>
        ) : (
          <Link href={`/audits/${audit.id}/review`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">Review</Link>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-950">{value}</p>
    </div>
  );
}
