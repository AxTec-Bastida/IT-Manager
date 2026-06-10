import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Edit, PackageCheck, Plus, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { assetLoanStatusLabels, assetLoanStatusTone, categoryLabels, statusLabels, statusTone, stockIssueStatusLabels, stockIssueStatusTone, stockIssueTypeLabels } from "@/lib/constants";
import { getActiveAssignmentItems, isActiveAssignment } from "@/lib/assignment-views";
import { getAssetDisplayName } from "@/lib/asset-display";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      assignedDevices: { orderBy: { name: "asc" } },
      assignments: { include: { items: { include: { asset: true } } }, orderBy: { assignmentDate: "desc" } },
      stockIssues: { include: { stockItem: true }, orderBy: { issuedAt: "desc" }, take: 12 },
      assetLoans: { include: { items: { include: { device: true } } }, orderBy: { loanStartAt: "desc" }, take: 12 },
    },
  });
  if (!employee) notFound();
  const activeAssignmentRecords = employee.assignments.filter(isActiveAssignment);
  const historicalAssignmentRecords = employee.assignments.filter((assignment) => !isActiveAssignment(assignment));

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
            <Link href={`/stock/issue?employeeId=${employee.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <PackageCheck size={16} />
              Issue / Loan Item
            </Link>
            <Link href={`/loans/quick-checkout?borrowerType=employee&borrowerId=${employee.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ClipboardList size={16} />
              Quick Asset Loan
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
              <p className="text-slate-500">Active assignment records</p>
              <p className="text-2xl font-semibold text-slate-950">{activeAssignmentRecords.length}</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-slate-500">Assignment history</p>
              <p className="text-2xl font-semibold text-slate-950">{historicalAssignmentRecords.length}</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-slate-500">Active stock loans</p>
              <p className="text-2xl font-semibold text-slate-950">{employee.stockIssues.filter((issue) => ["ACTIVE", "PARTIALLY_RETURNED"].includes(issue.status)).length}</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-slate-500">Active asset loans</p>
              <p className="text-2xl font-semibold text-slate-950">{employee.assetLoans.filter((loan) => ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"].includes(loan.status)).length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Currently assigned assets</h2>
        <div className="mt-3 grid gap-3">
          {employee.assignedDevices.map((asset) => (
            <article key={asset.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{asset.name}</p>
                  <p className="text-slate-600">{asset.assetTag || asset.serialNumber || asset.ipAddress || "No tag"}</p>
                </div>
                <Badge className={statusTone[asset.status]}>{statusLabels[asset.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{categoryLabels[asset.category]}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link href={`/devices/${asset.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 font-semibold text-white hover:bg-slate-800">
                  Open asset
                </Link>
                <Link href={`/devices/${asset.id}/return`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 font-semibold text-emerald-800 hover:bg-emerald-50">
                  <RotateCcw size={16} />
                  Return / Unassign
                </Link>
              </div>
            </article>
          ))}
          {employee.assignedDevices.length === 0 ? <p className="text-sm text-slate-500">No assets currently assigned.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Current assignment records</h2>
            <p className="text-sm text-slate-500">Long-term responsibility records that still have active items.</p>
          </div>
          <Link href={`/assignments?q=${encodeURIComponent(employee.employeeId || employee.fullName)}`} className="text-sm font-semibold text-slate-700 hover:text-slate-950">View active</Link>
        </div>
        <div className="mt-3 grid gap-3">
          {activeAssignmentRecords.map((assignment) => {
            const activeItems = getActiveAssignmentItems(assignment);
            return (
              <article key={assignment.id} className="rounded-md bg-slate-50 p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link href={`/assignments/${assignment.id}`} className="font-semibold text-slate-950 hover:underline">{assignment.assignmentNumber}</Link>
                    <p className="text-slate-600">{activeItems.length} active asset{activeItems.length === 1 ? "" : "s"} / assigned {assignment.assignmentDate.toLocaleDateString()}</p>
                    <p className="text-slate-500">{activeItems.slice(0, 3).map((item) => item.asset ? getAssetDisplayName(item.asset) : "Missing asset").join(", ")}</p>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-800 ring-indigo-200">{assignment.status.replaceAll("_", " ")}</Badge>
                </div>
              </article>
            );
          })}
          {activeAssignmentRecords.length === 0 ? <p className="text-sm text-slate-500">No active assignment records.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Serialized asset loans</h2>
          <Link href={`/loans?q=${encodeURIComponent(employee.employeeId || employee.fullName)}`} className="text-sm font-semibold text-slate-700 hover:text-slate-950">View all</Link>
        </div>
        <div className="mt-3 grid gap-3">
          {employee.assetLoans.map((loan) => (
            <article key={loan.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/loans/${loan.id}`} className="font-semibold text-slate-950 hover:underline">{loan.loanNumber}</Link>
                  <p className="text-slate-600">{loan.items.length} serialized asset{loan.items.length === 1 ? "" : "s"} / due {loan.expectedReturnAt.toLocaleDateString()}</p>
                  <p className="text-slate-500">{loan.items.slice(0, 3).map((item) => item.device.assetTag || item.device.name).join(", ")}</p>
                </div>
                <Badge className={assetLoanStatusTone[loan.status]}>{assetLoanStatusLabels[loan.status]}</Badge>
              </div>
              {["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"].includes(loan.status) ? (
                <Link href={`/loans/${loan.id}/return`} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto">
                  <RotateCcw size={16} />
                  Return assets
                </Link>
              ) : null}
            </article>
          ))}
          {employee.assetLoans.length === 0 ? <p className="text-sm text-slate-500">No serialized asset loans yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Stock handouts / loans</h2>
          <Link href={`/stock/issues?q=${encodeURIComponent(employee.employeeId || employee.fullName)}`} className="text-sm font-semibold text-slate-700 hover:text-slate-950">View all</Link>
        </div>
        <div className="mt-3 grid gap-3">
          {employee.stockIssues.map((issue) => (
            <article key={issue.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/stock/issues/${issue.id}`} className="font-semibold text-slate-950 hover:underline">{issue.stockItem.name}</Link>
                  <p className="text-slate-600">{stockIssueTypeLabels[issue.issueType]} • {issue.quantity} issued • {issue.returnedQuantity} returned</p>
                  <p className="text-slate-500">{issue.issuedAt.toLocaleDateString()} {issue.expectedReturnAt ? `• due ${issue.expectedReturnAt.toLocaleDateString()}` : ""}</p>
                </div>
                <Badge className={stockIssueStatusTone[issue.status]}>{stockIssueStatusLabels[issue.status]}</Badge>
              </div>
              {issue.issueType === "LOAN" && !["RETURNED", "CANCELLED"].includes(issue.status) ? (
                <Link href={`/stock/issues/${issue.id}/return`} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto">
                  <RotateCcw size={16} />
                  Return loan
                </Link>
              ) : null}
            </article>
          ))}
          {employee.stockIssues.length === 0 ? <p className="text-sm text-slate-500">No stock handouts or loans yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Assignment history</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {historicalAssignmentRecords.map((assignment) => (
            <Link key={assignment.id} href={`/assignments/${assignment.id}`} className="block py-3 text-sm hover:bg-slate-50">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{assignment.assignmentNumber}</p>
                <p className="text-slate-500">{assignment.assignmentDate.toLocaleString()}</p>
              </div>
              <p className="text-slate-600">{assignment.items.length} asset(s) • {assignment.status.replaceAll("_", " ")}</p>
            </Link>
          ))}
          {historicalAssignmentRecords.length === 0 ? <p className="text-sm text-slate-500">No returned assignment history yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
