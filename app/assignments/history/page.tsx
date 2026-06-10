import Link from "next/link";
import { ArrowLeft, ExternalLink, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { assignmentStatusLabels } from "@/lib/constants";
import { assignmentResponsibleLabel, assignmentReturnedAt, isHistoricalAssignment, matchesAssignmentSearch } from "@/lib/assignment-views";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function AssignmentHistoryPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q ?? "";
  const assignments = await prisma.assignment.findMany({
    include: { employee: true, items: { include: { asset: true } } },
    orderBy: { assignmentDate: "desc" },
  });
  const history = assignments.filter(isHistoricalAssignment).filter((assignment) => matchesAssignmentSearch(assignment, query));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment History"
        description="Returned and historical responsibility records for audit lookup."
        action={
          <div className="grid gap-2 sm:flex">
            <Link href="/assignments" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ArrowLeft size={16} />
              Active assignments
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
            placeholder="Search employee, assignment number, asset tag, serial, model"
            className="min-h-14 w-full rounded-md border border-slate-300 py-2 pl-10 pr-3 text-base"
          />
        </label>
        <button className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">
          Search history
        </button>
      </form>

      <section className="grid gap-3">
        {history.map((assignment) => {
          const returnedAt = assignmentReturnedAt(assignment);
          const signatureLabel = assignment.signatureData ? "Signature captured" : "No signature";
          return (
            <article key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Historical assignment</p>
                  <h2 className="font-semibold text-slate-950">{assignment.assignmentNumber}</h2>
                  <p className="text-sm text-slate-600">{assignmentResponsibleLabel(assignment)} / {assignment.items.length} asset{assignment.items.length === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-sm text-slate-500">Assigned {assignment.assignmentDate.toLocaleDateString()}{returnedAt ? ` / returned ${returnedAt.toLocaleDateString()}` : ""}</p>
                </div>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{assignmentStatusLabels[assignment.status]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={assignment.signatureData ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-900 ring-amber-200"}>{signatureLabel}</Badge>
                {assignment.items.slice(0, 3).map((item) => (
                  <Badge key={item.id} className="bg-slate-100 text-slate-700 ring-slate-200">{item.asset.assetTag || item.asset.name}</Badge>
                ))}
                {assignment.items.length > 3 ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">+{assignment.items.length - 3} more</Badge> : null}
              </div>
              <Link href={`/assignments/${assignment.id}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">
                <ExternalLink size={16} />
                Open record
              </Link>
            </article>
          );
        })}
        {history.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No returned assignment history matched this search.</div> : null}
      </section>
    </div>
  );
}
