import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AssetLoanForm } from "@/components/asset-loan-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { blockedAssetLoanStatuses } from "@/lib/asset-loans";
import { hasPagePermission } from "@/lib/page-permissions";

export default async function NewLoanPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await hasPagePermission("loans.write"))) return <ForbiddenPanel message="Creating asset loans requires IT Staff or Admin access." />;
  const params = (await searchParams) ?? {};
  const initialDeviceIds = typeof params.deviceId === "string" ? [params.deviceId] : [];
  const initialEmployeeId = typeof params.employeeId === "string" ? params.employeeId : "";
  const initialTemporaryBorrowerId = typeof params.temporaryBorrowerId === "string" ? params.temporaryBorrowerId : "";
  const [employees, temporaryBorrowers, devices] = await Promise.all([
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, employeeId: true, department: true } }),
    prisma.temporaryBorrower.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, tempId: true, name: true, department: true, area: true } }),
    prisma.device.findMany({
      where: { status: { notIn: blockedAssetLoanStatuses } },
      include: { employee: { select: { fullName: true } } },
      orderBy: [{ name: "asc" }],
      take: 600,
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/loans" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Asset Loans</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Create Asset Loan</h1>
        <p className="mt-1 text-sm text-slate-500">Checkout specific serialized assets temporarily. This does not replace assignments or stock issue loans.</p>
      </div>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Need the fast counter workflow?</h2>
            <p className="mt-1 text-sm text-slate-600">Use Quick Checkout to scan a borrower and asset without starting from dropdowns.</p>
          </div>
          <Link href="/loans/quick-checkout" className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Quick Checkout</Link>
        </div>
      </div>
      <AssetLoanForm employees={employees} temporaryBorrowers={temporaryBorrowers} devices={devices} initialDeviceIds={initialDeviceIds} initialEmployeeId={initialEmployeeId} initialTemporaryBorrowerId={initialTemporaryBorrowerId} />
    </div>
  );
}
