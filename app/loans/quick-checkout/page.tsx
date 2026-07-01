import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AssetLoanQuickCheckout } from "@/components/asset-loan-quick-checkout";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function QuickCheckoutPage({ searchParams }: Props) {
  if (!(await hasPagePermission("loans.write"))) return <ForbiddenPanel message="Quick asset checkout requires IT Staff or Admin access." />;
  const params = (await searchParams) ?? {};
  const assetId = typeof params.assetId === "string" ? params.assetId : "";
  const borrowerType = typeof params.borrowerType === "string" ? params.borrowerType : "";
  const borrowerId = typeof params.borrowerId === "string" ? params.borrowerId : "";

  const [asset, employee, temporaryBorrower] = await Promise.all([
    assetId
      ? prisma.device.findUnique({
          where: { id: assetId },
          include: {
            employee: { select: { fullName: true } },
            aliases: { select: { aliasType: true, value: true }, orderBy: { createdAt: "asc" } },
            rmaItems: { where: { result: "PENDING", rmaCase: { status: { in: ["SENT", "ACTIVE", "PARTIALLY_RETURNED"] } } }, take: 1 },
            assetLoanItems: { where: { returnStatus: "PENDING", loan: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } } }, take: 1 },
          },
        })
      : null,
    borrowerType === "employee" && borrowerId
      ? prisma.employee.findUnique({
          where: { id: borrowerId },
          include: {
            stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, take: 5 },
            assetLoans: { where: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } }, take: 5 },
          },
        })
      : null,
    borrowerType === "temporary" && borrowerId
      ? prisma.temporaryBorrower.findUnique({
          where: { id: borrowerId },
          include: {
            stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, take: 5 },
            assetLoans: { where: { status: { in: ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"] } }, take: 5 },
          },
        })
      : null,
  ]);

  const initialBorrower = employee
    ? {
        kind: "employee" as const,
        id: employee.id,
        name: employee.fullName,
        label: employee.employeeId ? `Employee ${employee.employeeId}` : "Employee",
        department: employee.department,
        openHref: `/employees/${employee.id}`,
        activeAssetLoans: employee.assetLoans.length,
        activeStockLoans: employee.stockIssues.length,
        email: employee.email,
        supervisorEmail: employee.supervisorEmail,
      }
    : temporaryBorrower
      ? {
          kind: "temporary" as const,
          id: temporaryBorrower.id,
          name: temporaryBorrower.name,
          label: `Temporary ${temporaryBorrower.tempId}`,
          department: temporaryBorrower.department || temporaryBorrower.area,
          openHref: `/temporary-borrowers/${temporaryBorrower.id}`,
          activeAssetLoans: temporaryBorrower.assetLoans.length,
          activeStockLoans: temporaryBorrower.stockIssues.length,
          email: temporaryBorrower.email,
        }
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quick Asset Checkout"
        description="Scan a borrower and serialized asset, confirm the return date, and create the loan."
        action={<Link href="/loans/new" className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">Advanced form</Link>}
      />
      <AssetLoanQuickCheckout initialBorrower={initialBorrower} initialAssets={asset ? [asset] : []} />
    </div>
  );
}
