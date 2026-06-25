import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AssignmentForm } from "@/components/assignment-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { assignableStatuses } from "@/lib/constants";
import { hasPagePermission } from "@/lib/page-permissions";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  if (!(await hasPagePermission("assignments.write"))) return <ForbiddenPanel message="Creating long-term assignments requires IT Staff or Admin access." />;
  const [user, employees, assets, targets] = await Promise.all([
    getCurrentUser(),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.device.findMany({ where: { status: { in: assignableStatuses } }, orderBy: { name: "asc" } }),
    prisma.assignmentTarget.findMany({ where: { isActive: true }, orderBy: [{ type: "asc" }, { path: "asc" }], take: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="New assignment" description="Assign one or more assets to a person, team, department, area, or station for long-term responsibility." />
      <AssignmentForm employees={employees} assets={assets} targets={targets} defaultTechName={user?.name || ""} />
    </div>
  );
}
