import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditEmployeePage({ params }: Props) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${employee.fullName}`} description="Update employee details and active status." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <EmployeeForm employee={employee} />
      </div>
    </div>
  );
}
