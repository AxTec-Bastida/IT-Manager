import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockIssueWorkflow } from "@/components/stock-issue-workflow";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockIssuePage({ searchParams }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Issuing or loaning stock requires IT Staff or Admin access." />;
  const params = await searchParams;
  const [employees, temporaryBorrowers, stockItems] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: { stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, include: { stockItem: true }, orderBy: { issuedAt: "desc" }, take: 5 } },
      orderBy: { fullName: "asc" },
    }),
    prisma.temporaryBorrower.findMany({
      where: { active: true },
      include: { stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, include: { stockItem: true }, orderBy: { issuedAt: "desc" }, take: 5 } },
      orderBy: { name: "asc" },
    }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: [{ quantityOnHand: "desc" }, { name: "asc" }] }),
  ]);
  const initialIssueType = params.issueType === "LOAN" || params.mode === "loan" ? "LOAN" : "HANDOUT";

  return (
    <div className="space-y-6">
      <PageHeader title="Issue / Loan Item" description="Scan a borrower, scan a quantity-based stock item, then hand out or loan one unit fast." />
      <StockIssueWorkflow
        employees={employees}
        temporaryBorrowers={temporaryBorrowers}
        stockItems={stockItems}
        initialEmployeeId={typeof params.employeeId === "string" ? params.employeeId : ""}
        initialTemporaryBorrowerId={typeof params.temporaryBorrowerId === "string" ? params.temporaryBorrowerId : ""}
        initialStockItemId={typeof params.stockItemId === "string" ? params.stockItemId : ""}
        initialIssueType={initialIssueType}
      />
    </div>
  );
}
