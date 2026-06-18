import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { OfflineConflictActions } from "@/components/offline-conflict-actions";
import { PageHeader } from "@/components/page-header";
import { ActionLink, EmptyState, MobileCard, PageActions } from "@/components/ui-patterns";
import { canMutateOfflineConflicts, canReadOfflineConflicts, getOfflineConflictHealth, getOfflineConflictRecords, offlineConflictInfo, type SanitizedOfflineConflictRecord } from "@/lib/offline-conflicts";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function OfflineConflictsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !canReadOfflineConflicts(user)) {
    return <ForbiddenPanel message="Offline conflict review requires signed-in inventory or audit access." />;
  }

  const query = await searchParams;
  const params = toSearchParams(query);
  const [records, health] = await Promise.all([
    getOfflineConflictRecords({ searchParams: params }),
    getOfflineConflictHealth(),
  ]);
  const mutable = canMutateOfflineConflicts(user);
  const activeFilters = [
    query.status ? `Status: ${query.status}` : null,
    query.resolution ? `Resolution: ${query.resolution}` : null,
    query.actionType ? `Action: ${query.actionType}` : null,
    query.code ? `Code: ${query.code}` : null,
    query.q ? `Search: ${query.q}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offline Conflict Review"
        description="Review failed or conflicted offline test notes and serialized asset moves. Conflicts are server-refused actions that need a human before retrying or cancelling."
        action={
          <PageActions>
            <ActionLink href="/offline">
              <ArrowLeft size={16} />
              Offline Queue
            </ActionLink>
            <ActionLink href="/data-quality" variant="primary">
              Data Quality
            </ActionLink>
          </PageActions>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard label="Open conflicts" value={health.openConflicts} tone={health.openConflicts ? "amber" : "emerald"} />
        <HealthCard label="Failed records" value={health.failedRecords} tone={health.failedRecords ? "red" : "slate"} />
        <HealthCard label="Last 7 days" value={health.conflictsLast7Days} tone={health.conflictsLast7Days ? "amber" : "slate"} />
        <HealthCard label="Reviewed / resolved" value={health.reviewedResolved} tone="slate" />
      </section>

      {health.oldestOpen ? (
        <MobileCard className="border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Oldest open conflict</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{health.oldestOpen.entityLabel || health.oldestOpen.clientActionId}</h2>
              <p className="mt-1 text-sm text-slate-700">{health.oldestOpen.title} - queued {new Date(health.oldestOpen.createdAt).toLocaleString()}</p>
            </div>
            <ActionLink href={`/offline/conflicts?q=${encodeURIComponent(health.oldestOpen.clientActionId)}`}>Open</ActionLink>
          </div>
        </MobileCard>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Filters</h2>
            <p className="mt-1 text-sm text-slate-600">Default view shows failed/conflicted sync records that still need attention.</p>
          </div>
          <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" action="/offline/conflicts">
            <label className="sr-only" htmlFor="offline-conflict-search">Search conflicts</label>
            <input id="offline-conflict-search" name="q" defaultValue={query.q ?? ""} placeholder="Search asset tag, actor, action ID..." className="min-h-12 rounded-lg border border-slate-300 px-3 text-sm" />
            <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
              <Search size={16} />
              Search
            </button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterLink label="Open" href="/offline/conflicts?resolution=OPEN" active={query.resolution === "OPEN"} />
          <FilterLink label="Failed" href="/offline/conflicts?status=FAILED" active={query.status === "FAILED"} />
          <FilterLink label="Conflict" href="/offline/conflicts?status=CONFLICT" active={query.status === "CONFLICT"} />
          <FilterLink label="Reviewed" href="/offline/conflicts?resolution=REVIEWED" active={query.resolution === "REVIEWED"} />
          <FilterLink label="Cancelled" href="/offline/conflicts?resolution=CANCELLED" active={query.resolution === "CANCELLED"} />
          <FilterLink label="Resolved" href="/offline/conflicts?resolution=RESOLVED" active={query.resolution === "RESOLVED"} />
          <FilterLink label="Moves" href="/offline/conflicts?actionType=MOVE_ASSET" active={query.actionType === "MOVE_ASSET"} />
          <FilterLink label="Test notes" href="/offline/conflicts?actionType=TEST_OFFLINE_NOTE" active={query.actionType === "TEST_OFFLINE_NOTE"} />
          <Link href="/offline/conflicts" className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Clear filters</Link>
        </div>
        {activeFilters.length ? <p className="mt-3 text-sm text-slate-500">{activeFilters.length} active filter{activeFilters.length === 1 ? "" : "s"}: {activeFilters.join(", ")}</p> : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-950">Review records</h2>
          <p className="text-sm text-slate-600">Retry runs the same server validation again. Cancel and reviewed actions keep the audit trail and do not apply the offline action.</p>
        </div>
        {records.length ? (
          <div className="grid gap-3">
            {records.map((record) => <OfflineConflictCard key={record.id} record={record} mutable={mutable} />)}
          </div>
        ) : (
          <EmptyState title="No offline conflicts found" description="Try clearing filters or syncing the offline queue. Open conflicts will appear here when the server refuses an offline action." action={<ActionLink href="/offline">Open Offline Queue</ActionLink>} />
        )}
      </section>
    </div>
  );
}

function OfflineConflictCard({ record, mutable }: { record: SanitizedOfflineConflictRecord; mutable: boolean }) {
  const info = offlineConflictInfo[record.conflictCode];
  const movedTo = [textValue(record.payload?.targetArea), textValue(record.payload?.targetDepartment), textValue(record.payload?.targetStation || record.payload?.targetLocationLabel)].filter(Boolean).join(" / ");
  const assetHref = record.entityType === "device" && record.entityId ? `/devices/${record.entityId}` : null;
  const statusIcon = record.status === "FAILED" ? XCircle : record.status === "SYNCED" ? CheckCircle2 : record.status === "CANCELLED" ? XCircle : AlertTriangle;
  const StatusIcon = statusIcon;
  return (
    <MobileCard className={info.tone === "red" ? "border-red-200" : info.tone === "amber" ? "border-amber-200" : undefined}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={record.status === "FAILED" ? "bg-red-50 text-red-800 ring-red-200" : record.status === "CONFLICT" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-700 ring-slate-200"}>
              <StatusIcon size={13} className="mr-1" />
              {record.status}
            </Badge>
            <Badge className="bg-slate-50 text-slate-700 ring-slate-200">{record.resolutionStatus}</Badge>
            <Badge className="bg-sky-50 text-sky-800 ring-sky-200">{record.actionType}</Badge>
            <Badge className="bg-white text-slate-700 ring-slate-200">{record.conflictCode}</Badge>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">{record.entityLabel || record.payload?.assetTag?.toString() || record.clientActionId}</h3>
          <p className="mt-1 text-sm font-medium text-slate-700">{record.conflictTitle}</p>
          <p className="mt-1 text-sm text-slate-600">{record.explanation}</p>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{record.recommendedAction}</p>

          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Info label="Queued asset" value={textValue(record.payload?.assetTag) || record.entityLabel || "Unknown"} />
            <Info label="Queued destination" value={movedTo || textValue(record.payload?.targetMapAnchorId) || "Not provided"} />
            <Info label="Actor" value={record.actorName || "Unknown"} />
            <Info label="Processed" value={record.processedAt ? new Date(record.processedAt).toLocaleString() : "Not processed"} />
          </dl>

          {record.payload?.notes ? <p className="mt-3 line-clamp-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Queued note: {String(record.payload.notes)}</p> : null}
          {record.reviewNote ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Review note: {record.reviewNote}</p> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {assetHref ? <ActionLink href={assetHref}>Open asset</ActionLink> : null}
            <ActionLink href={`/tasks/new?title=${encodeURIComponent(`Review offline conflict: ${record.entityLabel || record.clientActionId}`)}&category=INVENTORY`}>Create task</ActionLink>
          </div>

          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">Technical details</summary>
            <div className="mt-3 grid gap-3 text-xs text-slate-600">
              <p className="break-all"><span className="font-semibold text-slate-800">Client action:</span> {record.clientActionId}</p>
              {record.resultSummaryText ? <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-3">{record.resultSummaryText}</pre> : null}
              {record.payloadSummaryText ? <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-3">{record.payloadSummaryText}</pre> : null}
            </div>
          </details>
        </div>
        <div className="w-full lg:max-w-sm">
          <OfflineConflictActions recordId={record.id} mutable={mutable} />
        </div>
      </div>
    </MobileCard>
  );
}

function HealthCard({ label, value, tone }: { label: string; value: number; tone: "amber" | "red" | "emerald" | "slate" }) {
  const className = tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "red" ? "border-red-200 bg-red-50" : tone === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white";
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${className}`}>
      <p className="text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold ${active ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
      {label}
    </Link>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-800">{value}</dd>
    </div>
  );
}

function toSearchParams(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.trim()) params.set(key, value);
  }
  return params;
}

function textValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}
