import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { assignmentStatusLabels, categoryLabels, conditionLabels, statusLabels, statusTone } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AssignmentDetailPage({ params }: Props) {
  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { employee: true, items: { include: { asset: true } } },
  });
  if (!assignment) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={assignment.assignmentNumber}
        description={`Assigned to ${assignment.employee.fullName} on ${assignment.assignmentDate.toLocaleString()}`}
        action={
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-500" disabled>
            <Printer size={16} />
            Print coming soon
          </button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-100 text-indigo-800 ring-indigo-200">{assignmentStatusLabels[assignment.status]}</Badge>
            {assignment.termsAccepted ? <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">Terms accepted</Badge> : null}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Employee</dt>
              <dd className="mt-1 text-sm text-slate-950">
                <Link href={`/employees/${assignment.employee.id}`} className="font-semibold hover:underline">{assignment.employee.fullName}</Link>
              </dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Assigned by</dt>
              <dd className="mt-1 text-sm text-slate-950">{assignment.assignedBy || "-"}</dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Email status</dt>
              <dd className="mt-1 text-sm text-slate-950">Not implemented in Phase 1</dd>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <dt className="text-xs font-medium uppercase text-slate-500">Created</dt>
              <dd className="mt-1 text-sm text-slate-950">{assignment.createdAt.toLocaleString()}</dd>
            </div>
          </dl>
          {assignment.termsText ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{assignment.termsText}</p> : null}
          {assignment.notes ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{assignment.notes}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Signature</h2>
          {assignment.signatureData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assignment.signatureData} alt="Assignment signature" className="mt-3 rounded-md border border-slate-200 bg-white" />
          ) : (
            <p className="mt-3 text-sm text-slate-500">No signature captured.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Assigned assets</h2>
        <div className="mt-3 grid gap-3">
          {assignment.items.map((item) => (
            <Link key={item.id} href={`/devices/${item.asset.id}`} className="rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{item.asset.name}</p>
                  <p className="text-slate-600">{item.asset.assetTag || item.asset.serialNumber || item.asset.ipAddress || "No tag"}</p>
                  <p className="mt-1 text-xs text-slate-500">{categoryLabels[item.asset.category]} • Assigned condition: {item.assignedCondition ? conditionLabels[item.assignedCondition] : "-"}</p>
                </div>
                <Badge className={statusTone[item.asset.status]}>{statusLabels[item.asset.status]}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
