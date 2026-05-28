import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { categoryLabels, statusLabels, statusTone } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      assignedDevices: { orderBy: { name: "asc" } },
      assignments: { include: { items: { include: { asset: true } } }, orderBy: { assignmentDate: "desc" } },
    },
  });
  if (!employee) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.fullName}
        description={`${employee.department || "No department"} • ${employee.site || "No site"}`}
        action={
          <div className="grid gap-2 sm:flex">
            <Link href={`/assignments/new?employeeId=${employee.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Plus size={16} />
              Assign assets
            </Link>
            <Link href={`/employees/${employee.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Edit size={16} />
              Edit
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="font-semibold text-slate-950">Employee info</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Employee ID", employee.employeeId || "-"],
              ["Email", employee.email || "-"],
              ["Phone", employee.phoneNumber || "-"],
              ["Position/title", employee.title || "-"],
              ["Supervisor", employee.supervisorName || "-"],
              ["Supervisor email", employee.supervisorEmail || "-"],
              ["Status", employee.status],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
          {employee.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{employee.notes}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-slate-500">Currently assigned assets</p>
              <p className="text-2xl font-semibold text-slate-950">{employee.assignedDevices.length}</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-slate-500">Assignments</p>
              <p className="text-2xl font-semibold text-slate-950">{employee.assignments.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Currently assigned assets</h2>
        <div className="mt-3 grid gap-3">
          {employee.assignedDevices.map((asset) => (
            <Link key={asset.id} href={`/devices/${asset.id}`} className="rounded-md bg-slate-50 p-3 text-sm hover:bg-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{asset.name}</p>
                  <p className="text-slate-600">{asset.assetTag || asset.serialNumber || asset.ipAddress || "No tag"}</p>
                </div>
                <Badge className={statusTone[asset.status]}>{statusLabels[asset.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{categoryLabels[asset.category]}</p>
            </Link>
          ))}
          {employee.assignedDevices.length === 0 ? <p className="text-sm text-slate-500">No assets currently assigned.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Assignment history</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {employee.assignments.map((assignment) => (
            <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="block py-3 text-sm hover:bg-slate-50">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{assignment.assignmentNumber}</p>
                <p className="text-slate-500">{assignment.assignmentDate.toLocaleString()}</p>
              </div>
              <p className="text-slate-600">{assignment.items.length} asset(s) • {assignment.status.replaceAll("_", " ")}</p>
            </Link>
          ))}
          {employee.assignments.length === 0 ? <p className="text-sm text-slate-500">No assignments yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
