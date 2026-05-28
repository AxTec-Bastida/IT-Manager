import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function EmployeesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.toLowerCase() ?? "";
  const employees = await prisma.employee.findMany({
    include: { assignedDevices: true, assignments: true },
    orderBy: { fullName: "asc" },
  });
  const filtered = employees.filter((employee) => {
    const matchesSearch =
      !q ||
      [employee.fullName, employee.employeeId, employee.email, employee.department, employee.site]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    const matchesStatus = !params.status || employee.status === params.status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="People and departments that can receive assigned warehouse IT equipment."
        action={
          <Link href="/employees/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus size={16} />
            Add employee
          </Link>
        }
      />

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
        <label className="relative md:col-span-2">
          <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search name, ID, email, department, site" className="min-h-12 w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base sm:text-sm" />
        </label>
        <select name="status" defaultValue={params.status ?? ""} className="min-h-12 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button className="min-h-12 rounded-md bg-slate-950 px-4 py-2 text-base font-semibold text-white sm:text-sm">Apply</button>
      </form>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Assigned assets</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((employee) => (
              <tr key={employee.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/employees/${employee.id}`} className="font-semibold text-slate-950 hover:underline">{employee.fullName}</Link>
                  <p className="text-xs text-slate-500">{employee.employeeId || "No employee ID"}</p>
                </td>
                <td className="px-4 py-3">{employee.email || "-"}</td>
                <td className="px-4 py-3">{employee.department || "-"}</td>
                <td className="px-4 py-3">{employee.site || "-"}</td>
                <td className="px-4 py-3">{employee.assignedDevices.length}</td>
                <td className="px-4 py-3"><Badge className={employee.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-zinc-200 text-zinc-700 ring-zinc-300"}>{employee.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {filtered.map((employee) => (
          <Link key={employee.id} href={`/employees/${employee.id}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{employee.fullName}</h2>
                <p className="text-sm text-slate-600">{employee.employeeId || employee.email || "No ID/email"}</p>
              </div>
              <Badge className={employee.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-zinc-200 text-zinc-700 ring-zinc-300"}>{employee.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">{employee.department || "No department"} • {employee.site || "No site"}</p>
            <p className="mt-1 text-xs text-slate-500">{employee.assignedDevices.length} assigned asset(s)</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
