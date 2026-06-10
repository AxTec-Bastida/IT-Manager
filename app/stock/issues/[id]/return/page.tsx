import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockIssueReturnForm } from "@/components/stock-issue-return-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { borrowerLabel } from "@/lib/stock-issues";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ReturnStockIssuePage({ params }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Returning stock loans requires IT Staff or Admin access." />;
  const { id } = await params;
  const issue = await prisma.stockIssue.findUnique({ where: { id }, include: { stockItem: true, employee: true, temporaryBorrower: true } });
  if (!issue) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Return ${issue.stockItem.name}`} description={`Loan return for ${borrowerLabel(issue)}.`} />
      <StockIssueReturnForm issue={issue} />
    </div>
  );
}
