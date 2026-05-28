import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { assignmentStatusLabels } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const assignments = await prisma.assignment.findMany({
    include: { employee: true, items: { include: { asset: true } } },
    orderBy: { assignmentDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        description="Long-term equipment responsibility records with employee signatures."
        action={
          <Link href="/assignments/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus size={16} />
            New assignment
          </Link>
        }
      />
      <div className="grid gap-3">
        {assignments.map((assignment) => (
          <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">{assignment.assignmentNumber}</h2>
                <p className="text-sm text-slate-600">{assignment.employee.fullName} • {assignment.items.length} asset(s)</p>
              </div>
              <Badge className="bg-indigo-100 text-indigo-800 ring-indigo-200">{assignmentStatusLabels[assignment.status]}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-500">{assignment.assignmentDate.toLocaleString()}</p>
          </Link>
        ))}
        {assignments.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No assignments yet.</div> : null}
      </div>
    </div>
  );
}
