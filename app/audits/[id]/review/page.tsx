import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, Download, ScanLine, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, PageActions } from "@/components/ui-patterns";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { auditFindingTaskHref, auditProgress, auditScopeLabel } from "@/lib/audits";
import { hasPagePermission } from "@/lib/page-permissions";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AuditReviewPage({ params }: Props) {
  if (!(await hasPagePermission("audits.read"))) return <ForbiddenPanel message="Reviewing audit findings requires Auditor, IT Staff, or Admin access." />;
  const { id } = await params;
  const audit = await prisma.inventoryAuditSession.findUnique({
    where: { id },
    include: {
      expectedItems: { include: { device: true }, orderBy: { expectedDisplayName: "asc" } },
      scans: { include: { matchedDevice: true }, orderBy: { scannedAt: "desc" } },
    },
  });
  if (!audit) notFound();
  const progress = auditProgress(audit.expectedItems, audit.scans);
  const missing = audit.expectedItems.filter((item) => item.resultStatus === "PENDING" || item.resultStatus === "MISSING");
  const wrongArea = audit.scans.filter((scan) => scan.resultType === "FOUND_WRONG_AREA" || scan.resultType === "FOUND_NOT_EXPECTED");
  const unknown = audit.scans.filter((scan) => scan.resultType === "UNKNOWN_LABEL");
  const duplicate = audit.scans.filter((scan) => scan.resultType === "DUPLICATE_SCAN");
  const needsReview = audit.scans.filter((scan) => scan.resultType === "NEEDS_REVIEW");
  const found = audit.expectedItems.filter((item) => item.resultStatus === "FOUND");
  const originalScanTimes = originalScanTimesByDuplicate(audit.scans);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Review"
        description={`${audit.title} - ${auditScopeLabel(audit)} - ${progress.found}/${progress.expected} found`}
        action={
          <PageActions>
            {audit.status === "ACTIVE" ? (
              <ActionLink href={`/audits/${audit.id}/scan`}>
                <ScanLine size={16} />
                Scan more
              </ActionLink>
            ) : null}
            {["ACTIVE", "REVIEW"].includes(audit.status) ? (
              <ActionLink href={`/audits/${audit.id}/close`} variant="primary">
                <CheckCircle size={16} />
                Close
              </ActionLink>
            ) : null}
          </PageActions>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Missing" value={missing.length} />
        <Metric label="Wrong area" value={wrongArea.length} />
        <Metric label="Unknown" value={unknown.length} />
        <Metric label="Duplicate" value={duplicate.length} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-950">Exports</h2>
        <p className="mt-1 text-sm text-slate-600">Download audit findings as CSV. Export actions never update device status or location.</p>
        <ExportButtonGrid auditId={audit.id} />
      </section>

      <ReviewSection title="Missing expected assets" count={missing.length}>
        {missing.map((item) => <ExpectedItemCard key={item.id} item={item} audit={audit} />)}
      </ReviewSection>

      <ReviewSection title="Found in wrong area / not expected" count={wrongArea.length}>
        {wrongArea.map((scan) => <ScanCard key={scan.id} scan={scan} audit={audit} showMove />)}
      </ReviewSection>

      <ReviewSection title="Unknown / unlinked labels" count={unknown.length}>
        {unknown.map((scan) => <ScanCard key={scan.id} scan={scan} audit={audit} />)}
      </ReviewSection>

      <ReviewSection title="Duplicate scans" count={duplicate.length}>
        {duplicate.map((scan) => <ScanCard key={scan.id} scan={scan} audit={audit} originalScanAt={originalScanTimes.get(scan.id)} />)}
      </ReviewSection>

      <ReviewSection title="Needs review" count={needsReview.length}>
        {needsReview.map((scan) => <ScanCard key={scan.id} scan={scan} audit={audit} />)}
      </ReviewSection>

      <ReviewSection title="Found expected" count={found.length}>
        {found.slice(0, 25).map((item) => <ExpectedItemCard key={item.id} item={item} audit={audit} found />)}
      </ReviewSection>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ReviewSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{count}</span>
      </div>
      {count ? <div className="grid gap-3 md:grid-cols-2">{children}</div> : <EmptyState title={`No ${title.toLowerCase()}`} />}
    </section>
  );
}

function ExpectedItemCard({
  item,
  audit,
  found = false,
}: {
  item: {
    id: string;
    expectedDisplayName: string;
    expectedAssetTag: string | null;
    expectedCategory: string;
    expectedLocation: string | null;
    device: { id: string; status: string; location: string | null; areaDepartment: string | null };
  };
  audit: { id: string; auditNumber: string | null; title: string };
  found?: boolean;
}) {
  const taskHref = auditFindingTaskHref({
    audit,
    type: found ? "needs-review" : "missing",
    assetTag: item.expectedAssetTag,
    assetName: item.expectedDisplayName,
    expectedLocation: item.expectedLocation,
    currentLocation: item.device.location || item.device.areaDepartment,
    relatedDeviceId: item.device.id,
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-slate-950">{item.expectedDisplayName}</h3>
          <p className="font-mono text-sm text-slate-600">{item.expectedAssetTag || "No tag"}</p>
          <p className="text-sm text-slate-500">{item.expectedCategory.replaceAll("_", " ")} - Expected: {item.expectedLocation || "No location"}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${found ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{found ? "Found" : "Missing"}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link href={`/devices/${item.device.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">Open asset</Link>
        {!found ? <Link href={taskHref} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Create task</Link> : null}
        {!found ? <Link href={taskHref} className="inline-flex min-h-12 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900">Start investigation</Link> : null}
        {!found ? <span className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-100 px-3 text-center text-sm font-semibold text-slate-600">Missing in audit only</span> : null}
      </div>
    </article>
  );
}

function ScanCard({
  scan,
  audit,
  showMove = false,
  originalScanAt,
}: {
  scan: {
    id: string;
    scannedValue: string;
    resultType: string;
    scannedAt: Date;
    notes: string | null;
    matchedDevice: { id: string; name: string; assetTag: string | null; location: string | null; areaDepartment: string | null } | null;
  };
  audit: { id: string; auditNumber: string | null; title: string };
  showMove?: boolean;
  originalScanAt?: Date | null;
}) {
  const findingType = scan.resultType === "UNKNOWN_LABEL" ? "unknown-label" : scan.resultType === "DUPLICATE_SCAN" ? "duplicate" : scan.resultType === "NEEDS_REVIEW" ? "needs-review" : "wrong-area";
  const taskHref = auditFindingTaskHref({
    audit,
    type: findingType,
    scannedValue: scan.scannedValue,
    assetTag: scan.matchedDevice?.assetTag,
    assetName: scan.matchedDevice?.name,
    currentLocation: scan.matchedDevice?.location || scan.matchedDevice?.areaDepartment,
    timestamp: scan.scannedAt,
    relatedDeviceId: scan.matchedDevice?.id,
  });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-slate-950">{scan.matchedDevice?.name || scan.scannedValue}</h3>
          <p className="break-all font-mono text-sm text-slate-600">{scan.scannedValue}</p>
          {scan.notes ? <p className="mt-1 text-sm text-slate-500">{scan.notes}</p> : null}
          {scan.matchedDevice ? <p className="mt-1 text-sm text-slate-500">{scan.matchedDevice.location || scan.matchedDevice.areaDepartment || "No location"}</p> : null}
          {originalScanAt ? <p className="mt-1 text-sm text-slate-500">Original scan: {originalScanAt.toLocaleString()}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{scan.resultType.replaceAll("_", " ")}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {scan.matchedDevice ? <Link href={`/devices/${scan.matchedDevice.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">Open asset</Link> : null}
        {showMove && scan.matchedDevice ? <Link href={`/devices/${scan.matchedDevice.id}/move?fromAuditId=${audit.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Move asset here</Link> : null}
        <Link href={taskHref} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Create task</Link>
        {scan.resultType === "UNKNOWN_LABEL" ? <Link href={`/devices?q=${encodeURIComponent(scan.scannedValue)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700"><Search size={16} />Search asset</Link> : null}
        {scan.resultType === "UNKNOWN_LABEL" ? <span className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-100 px-3 text-center text-sm font-semibold text-slate-600">Link label after asset match</span> : null}
        {showMove ? <span className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-100 px-3 text-center text-sm font-semibold text-slate-600">Keep current location</span> : null}
        {scan.resultType === "DUPLICATE_SCAN" ? <span className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-100 px-3 text-center text-sm font-semibold text-slate-600">Ignore duplicate in audit</span> : null}
      </div>
    </article>
  );
}

function originalScanTimesByDuplicate(scans: Array<{ id: string; matchedDeviceId: string | null; resultType: string; scannedAt: Date }>) {
  const sorted = [...scans].sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime());
  const firstSeenByDevice = new Map<string, Date>();
  const originalsByDuplicate = new Map<string, Date | null>();
  for (const scan of sorted) {
    if (!scan.matchedDeviceId || scan.resultType === "IGNORED") continue;
    if (scan.resultType === "DUPLICATE_SCAN") {
      originalsByDuplicate.set(scan.id, firstSeenByDevice.get(scan.matchedDeviceId) ?? null);
      continue;
    }
    if (!firstSeenByDevice.has(scan.matchedDeviceId)) firstSeenByDevice.set(scan.matchedDeviceId, scan.scannedAt);
  }
  return originalsByDuplicate;
}
