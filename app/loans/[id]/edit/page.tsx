import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AssetLoanForm } from "@/components/asset-loan-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { blockedAssetLoanStatuses } from "@/lib/asset-loans";
import { hasPagePermission } from "@/lib/page-permissions";

type Context = { params: Promise<{ id: string }> };

export default async function EditLoanPage({ params }: Context) {
  if (!(await hasPagePermission("loans.write"))) return <ForbiddenPanel message="Editing asset loans requires IT Staff or Admin access." />;
  const { id } = await params;
  const [loan, employees, temporaryBorrowers, devices] = await Promise.all([
    prisma.assetLoan.findUnique({ where: { id }, include: { items: { include: { device: { include: { employee: { select: { fullName: true } } } } } } } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, employeeId: true, department: true, email: true, supervisorEmail: true } }),
    prisma.temporaryBorrower.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, tempId: true, name: true, department: true, area: true, email: true } }),
    prisma.device.findMany({
      where: { OR: [{ status: { notIn: blockedAssetLoanStatuses } }, { assetLoanItems: { some: { loanId: id } } }] },
      include: { employee: { select: { fullName: true } } },
      orderBy: [{ name: "asc" }],
      take: 700,
    }),
  ]);
  if (!loan) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/loans/${loan.id}`} className="text-sm font-semibold text-slate-600 hover:text-slate-950">{loan.loanNumber}</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Edit Asset Loan</h1>
      </div>
      <AssetLoanForm employees={employees} temporaryBorrowers={temporaryBorrowers} devices={devices} loan={loan} />
    </div>
  );
}
