import Link from "next/link";
import { AlertTriangle, ClipboardList, ExternalLink, History, Plus, RotateCcw, Search, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { assignmentStatusLabels, categoryLabels, statusLabels, statusTone } from "@/lib/constants";
import { getAssetDisplayName, getAssetIdentityLine } from "@/lib/asset-display";
import { assignmentResponsibleLabel, getActiveAssignmentItems, getAssignmentReviewReasons, groupActiveAssignmentsByEmployee, isActiveAssignment, matchesAssignmentSearch } from "@/lib/assignment-views";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AssignmentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const view = params.view === "by-employee" || params.view === "needs-review" ? params.view : "active";
  const query = params.q ?? "";

  const assignments = await prisma.assignment.findMany({
    include: { employee: true, items: { include: { asset: true } } },
    orderBy: { assignmentDate: "desc" },
  });

  const activeAssignments = assignments.filter(isActiveAssignment).filter((assignment) => matchesAssignmentSearch(assignment, query));
  const reviewAssignments = assignments
    .map((assignment) => ({ assignment, reasons: getAssignmentReviewReasons(assignment) }))
    .filter((entry) => entry.reasons.length > 0 && matchesAssignmentSearch(entry.assignment, query));
  const activeItems = activeAssignments.flatMap((assignment) => getActiveAssignmentItems(assignment).map((item) => ({ assignment, item })));
  const employeeGroups = groupActiveAssignmentsByEmployee(activeAssignments);
  const returnedCount = assignments.filter((assignment) => !isActiveAssignment(assignment)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Current long-term equipment responsibility. Returned records stay in history."
        action={
          <div className="grid gap-2 sm:flex">
            <Link href="/assignments/history" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <History size={16} />
              History
            </Link>
            <Link href="/assignments/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Plus size={16} />
              New assignment
            </Link>
          </div>
        }
      />

      <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="absolute left-3 top-4 text-slate-400" size={18} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search employee, asset tag, serial, model, department, location"
            className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-base"
          />
        </label>
        {view !== "active" ? <input type="hidden" name="view" value={view} /> : null}
        <button className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">
          Search assignments
        </button>
      </form>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        <AssignmentTab href="/assignments" active={view === "active"} label="Active" count={activeAssignments.length} />
        <AssignmentTab href="/assignments?view=by-employee" active={view === "by-employee"} label="By Target" count={employeeGroups.length} />
        <AssignmentTab href="/assignments?view=needs-review" active={view === "needs-review"} label="Needs Review" count={reviewAssignments.length} />
        <AssignmentTab href="/assignments/history" active={false} label="History" count={returnedCount} />
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Active assignments" value={activeAssignments.length} helper="Records with equipment still out" />
        <SummaryCard label="Assigned assets" value={activeItems.length} helper="Current long-term responsibility items" />
        <SummaryCard label="Targets" value={employeeGroups.length} helper="People, teams, or areas holding equipment" />
        <SummaryCard label="Needs review" value={reviewAssignments.length} helper="Status, signature, or item mismatches" />
      </section>

      {view === "by-employee" ? (
        <section className="grid gap-3">
          {employeeGroups.map((group) => (
            <article key={group.employee.id || group.employee.employeeId || group.employee.fullName} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Responsibility target</p>
                  <h2 className="text-lg font-semibold text-slate-950">{group.responsibleLabel || "Unknown target"}</h2>
                  <p className="text-sm text-slate-600">{[group.employee.employeeId, group.employee.department].filter(Boolean).join(" / ") || group.employee.employeeId || "Team / area responsibility"}</p>
                  <p className="mt-2 text-sm text-slate-500">{group.activeItems.length} active asset{group.activeItems.length === 1 ? "" : "s"} across {group.assignments.length} assignment{group.assignments.length === 1 ? "" : "s"}</p>
                </div>
                {group.employee.id && group.employee.id !== group.responsibleLabel ? <Link href={`/employees/${group.employee.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <Users size={16} />
                  Open employee
                </Link> : null}
              </div>
              <div className="mt-3 grid gap-2">
                {group.activeItems.slice(0, 4).map((item) => (
                  <AssetLine key={item.id || item.asset?.id} item={item} assignment={group.assignments[0]} />
                ))}
                {group.activeItems.length > 4 ? <p className="text-sm text-slate-500">+{group.activeItems.length - 4} more assigned asset(s)</p> : null}
              </div>
            </article>
          ))}
          {employeeGroups.length === 0 ? <EmptyAssignments message="No active assigned equipment matched this search." /> : null}
        </section>
      ) : view === "needs-review" ? (
        <section className="grid gap-3">
          {reviewAssignments.map(({ assignment, reasons }) => (
            <article key={assignment.id} className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase text-amber-700">Needs review</p>
                  <h2 className="font-semibold text-slate-950">{assignment.assignmentNumber}</h2>
                  <p className="text-sm text-slate-600">{assignmentResponsibleLabel(assignment)} / {assignment.items.length} asset(s)</p>
                </div>
                <Badge className="bg-amber-100 text-amber-900 ring-amber-200">{assignmentStatusLabels[assignment.status]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {reasons.slice(0, 4).map((reason) => (
                  <Badge key={reason} className="bg-amber-100 text-amber-900 ring-amber-200">{reason}</Badge>
                ))}
                {reasons.length > 4 ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">+{reasons.length - 4} more</Badge> : null}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Link href={`/assignments/${assignment.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                  <ExternalLink size={16} />
                  Open assignment
                </Link>
                <Link href={`/tasks/new?category=INVENTORY&title=${encodeURIComponent(`Review assignment ${assignment.assignmentNumber}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <Plus size={16} />
                  Create task
                </Link>
              </div>
            </article>
          ))}
          {reviewAssignments.length === 0 ? <EmptyAssignments message="No assignment review issues found." /> : null}
        </section>
      ) : (
        <section className="space-y-5">
          <div className="grid gap-3">
            {activeAssignments.map((assignment) => {
              const active = getActiveAssignmentItems(assignment);
              return (
                <article key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">Active assignment</p>
                      <h2 className="text-lg font-semibold text-slate-950">{assignmentResponsibleLabel(assignment)}</h2>
                      <p className="text-sm text-slate-600">{assignment.assignmentNumber} / {active.length} active asset{active.length === 1 ? "" : "s"}</p>
                      <p className="mt-1 text-sm text-slate-500">Assigned since {assignment.assignmentDate.toLocaleDateString()}</p>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-800 ring-indigo-200">{assignmentStatusLabels[assignment.status]}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {active.slice(0, 3).map((item) => <AssetLine key={item.id || item.asset?.id} item={item} assignment={assignment} />)}
                    {active.length > 3 ? <p className="text-sm text-slate-500">+{active.length - 3} more active asset(s)</p> : null}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Link href={`/assignments/${assignment.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                      <ExternalLink size={16} />
                      Open
                    </Link>
                    {active[0]?.asset?.id ? (
                      <Link href={`/devices/${active[0].asset.id}/return`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
                        <RotateCcw size={16} />
                        Return / Unassign
                      </Link>
                    ) : null}
                    <Link href={`/tasks/new?category=INVENTORY&title=${encodeURIComponent(`Follow up ${assignment.assignmentNumber}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      <Plus size={16} />
                      Create task
                    </Link>
                  </div>
                </article>
              );
            })}
            {activeAssignments.length === 0 ? <EmptyAssignments message="No active assigned equipment matched this search." /> : null}
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Active assigned assets</h2>
                <p className="text-sm text-slate-500">Asset-focused view for quick returns from the counter.</p>
              </div>
              <ClipboardList className="text-slate-400" size={20} />
            </div>
            <div className="mt-3 grid gap-2">
              {activeItems.slice(0, 25).map(({ assignment, item }) => <AssetLine key={`${assignment.id}-${item.id}`} item={item} assignment={assignment} detailed />)}
              {activeItems.length > 25 ? <p className="text-sm text-slate-500">Showing first 25 active assets. Use search to narrow the list.</p> : null}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

function AssignmentTab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>{count}</span>
    </Link>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function AssetLine({ item, assignment, detailed = false }: { item: ReturnType<typeof getActiveAssignmentItems>[number]; assignment: { id?: string; assignmentNumber?: string | null; assignmentDate?: Date | string | null; employee?: { id?: string; fullName?: string | null } | null; targetName?: string | null; targetPath?: string | null }; detailed?: boolean }) {
  const asset = item.asset;
  if (!asset) {
    return <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">Missing asset details</div>;
  }
  const assignedDate = assignment.assignmentDate ? new Date(assignment.assignmentDate).toLocaleDateString() : "date not recorded";
  return (
    <div className="rounded-md bg-slate-50 p-3 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">{getAssetDisplayName(asset)}</p>
          <p className="text-slate-600">{getAssetIdentityLine(asset)}</p>
          {detailed ? <p className="text-slate-500">Responsible: {assignmentResponsibleLabel(assignment)} since {assignedDate}</p> : null}
          {asset.location ? <p className="text-slate-500">Location: {asset.location}</p> : null}
        </div>
        {asset.status ? <Badge className={statusTone[asset.status as keyof typeof statusTone]}>{statusLabels[asset.status as keyof typeof statusLabels] ?? asset.status.replaceAll("_", " ")}</Badge> : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {asset.category ? categoryLabels[asset.category as keyof typeof categoryLabels] : "Asset"}
        {assignment.assignmentNumber ? ` / ${assignment.assignmentNumber}` : ""}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Link href={`/devices/${asset.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-3 font-semibold text-white hover:bg-slate-800">
          Open asset
        </Link>
        {assignment.id ? (
          <Link href={`/assignments/${assignment.id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100">
            Open assignment
          </Link>
        ) : null}
        <Link href={`/devices/${asset.id}/return`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 font-semibold text-emerald-800 hover:bg-emerald-50">
          <RotateCcw size={15} />
          Return
        </Link>
      </div>
    </div>
  );
}

function EmptyAssignments({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      <AlertTriangle className="mx-auto mb-2 text-slate-400" size={22} />
      {message}
    </div>
  );
}
