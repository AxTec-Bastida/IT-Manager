import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCheck, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { EmailActionButton } from "@/components/email-action-button";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { stockIssueStatusLabels, stockIssueStatusTone, stockIssueTypeLabels, stockMovementTypeLabels, stockReturnConditionLabels } from "@/lib/constants";
import { borrowerLabel, isStockLoanOverdue } from "@/lib/stock-issues";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StockIssueDetailPage({ params }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Stock issue records require IT Staff or Admin access." />;
  const { id } = await params;
  const issue = await prisma.stockIssue.findUnique({
    where: { id },
    include: {
      stockItem: true,
      employee: true,
      temporaryBorrower: true,
      movements: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!issue) notFound();
  const recipient = issue.employee?.email || issue.temporaryBorrower?.email || "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={issue.issueNumber || `${stockIssueTypeLabels[issue.issueType]} ${issue.stockItem.name}`}
        description={`${stockIssueTypeLabels[issue.issueType]} for ${borrowerLabel(issue)}`}
        action={
          <div className="grid gap-2 sm:flex">
            <Link href="/stock/issue" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><PackageCheck size={16} />Issue / Loan Item</Link>
            {issue.issueType === "LOAN" && !["RETURNED", "CANCELLED"].includes(issue.status) ? <Link href={`/stock/issues/${issue.id}/return`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><RotateCcw size={16} />Return Loan</Link> : null}
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Badge className={stockIssueStatusTone[issue.status]}>{stockIssueStatusLabels[issue.status]}</Badge>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{stockIssueTypeLabels[issue.issueType]}</Badge>
            {isStockLoanOverdue(issue) ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Overdue</Badge> : null}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Stock item", issue.stockItem.name],
              ["Borrower", borrowerLabel(issue)],
              ["Quantity", issue.quantity],
              ["Returned quantity", issue.returnedQuantity],
              ["Issued at", issue.issuedAt.toLocaleString()],
              ["Expected return", issue.expectedReturnAt?.toLocaleDateString() || "-"],
              ["Returned at", issue.returnedAt?.toLocaleString() || "-"],
              ["Condition out", issue.conditionOut || "-"],
              ["Condition in", issue.conditionIn ? stockReturnConditionLabels[issue.conditionIn] : "-"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
          {issue.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{issue.notes}</p> : null}
          {issue.returnNotes ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{issue.returnNotes}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Open related record</h2>
          <div className="mt-3 grid gap-2">
            <Link href={`/stock/${issue.stockItemId}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Open stock item</Link>
            {issue.employeeId ? <Link href={`/employees/${issue.employeeId}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Open employee</Link> : null}
            {issue.temporaryBorrowerId ? <Link href={`/temporary-borrowers/${issue.temporaryBorrowerId}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Open temporary borrower</Link> : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Stock movements</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {issue.movements.map((movement) => (
            <div key={movement.id} className="py-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-slate-950">{stockMovementTypeLabels[movement.movementType]}</p>
                <p className="text-slate-500">{movement.createdAt.toLocaleString()}</p>
              </div>
              <p className="text-slate-600">{movement.previousQuantity} to {movement.newQuantity} ({movement.quantity})</p>
              {movement.notes ? <p className="text-slate-500">{movement.notes}</p> : null}
            </div>
          ))}
          {issue.movements.length === 0 ? <p className="text-sm text-slate-500">No movement rows linked to this issue yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Email receipts</h2>
        <p className="mt-1 text-sm text-slate-500">Send a stock handout or loan receipt manually. Email failures are logged but do not change stock records.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EmailActionButton endpoint={`/api/stock/issues/${issue.id}/email`} kind="issue" label={issue.issueType === "HANDOUT" ? "Send handout receipt" : "Send loan receipt"} defaultRecipient={recipient} />
          {issue.returnedQuantity > 0 ? <EmailActionButton endpoint={`/api/stock/issues/${issue.id}/email`} kind="return" label="Send return confirmation" defaultRecipient={recipient} /> : null}
        </div>
      </section>
    </div>
  );
}
