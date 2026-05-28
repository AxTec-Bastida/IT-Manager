import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AssignmentForm } from "@/components/assignment-form";
import { assignableStatuses } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  const [employees, assets] = await Promise.all([
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.device.findMany({ where: { status: { in: assignableStatuses } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="New assignment" description="Assign one or more assets to an employee for long-term responsibility." />
      <AssignmentForm employees={employees} assets={assets} />
    </div>
  );
}
