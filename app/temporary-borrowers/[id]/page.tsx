import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ClipboardList, Edit, PackageCheck, RotateCcw, ScanLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { assetLoanStatusLabels, assetLoanStatusTone, stockIssueStatusLabels, stockIssueStatusTone, stockIssueTypeLabels } from "@/lib/constants";
import { isStockLoanOverdue } from "@/lib/stock-issues";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TemporaryBorrowerDetailPage({ params }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Temporary borrower stock workflows require IT Staff or Admin access." />;
  const { id } = await params;
  const borrower = await prisma.temporaryBorrower.findUnique({
    where: { id },
    include: {
      stockIssues: { include: { stockItem: true }, orderBy: { issuedAt: "desc" } },
      assetLoans: { include: { items: { include: { device: true } } }, orderBy: { loanStartAt: "desc" } },
    },
  });
  if (!borrower) notFound();
  const activeLoans = borrower.stockIssues.filter((issue) => ["ACTIVE", "PARTIALLY_RETURNED"].includes(issue.status));
  const activeAssetLoans = borrower.assetLoans.filter((loan) => ["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"].includes(loan.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title={borrower.name}
        description={`${borrower.tempId} / ${borrower.department || borrower.area || "No department/area"}`}
        action={
          <div className="grid gap-2 sm:flex">
            <Link href={`/stock/issue?temporaryBorrowerId=${borrower.id}&issueType=LOAN`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><PackageCheck size={16} />Issue / Loan Item</Link>
            <Link href={`/loans/quick-checkout?borrowerType=temporary&borrowerId=${borrower.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ClipboardList size={16} />Quick Asset Loan</Link>
            <Link href={`/temporary-borrowers/${borrower.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Edit size={16} />Edit</Link>
          </div>
        }
      />

      {borrower.needsReview && (
        <section className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Walk-up profile - details needed</p>
            <p className="mt-1 text-sm text-amber-800">
              This borrower was created from a badge scan during checkout. Fill in their name, department, and contact info so the record is complete.
            </p>
            {borrower.badgeId && (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                <ScanLine size={14} />
                Scanned badge ID: <span className="font-mono font-semibold">{borrower.badgeId}</span>
              </p>
            )}
          </div>
          <Link
            href={`/temporary-borrowers/${borrower.id}/edit`}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800"
          >
            <Edit size={14} />
            Fill details
          </Link>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="font-semibold text-slate-950">Borrower info</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Status", borrower.active ? "Active" : "Inactive"],
              ...(borrower.badgeId ? [["Badge ID", borrower.badgeId]] : []),
              ["Department", borrower.department || "-"],
              ["Area", borrower.area || "-"],
              ["Supervisor", borrower.supervisorName || "-"],
              ["Phone", borrower.phone || "-"],
              ["Email", borrower.email || "-"],
              ["Reason", borrower.reason || "-"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
          {borrower.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{borrower.notes}</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Summary</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-md bg-slate-50 p-3"><span className="text-sm text-slate-500">Active loans</span><p className="text-2xl font-semibold">{activeLoans.length}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><span className="text-sm text-slate-500">Active asset loans</span><p className="text-2xl font-semibold">{activeAssetLoans.length}</p></div>
            <div className="rounded-md bg-slate-50 p-3"><span className="text-sm text-slate-500">All issues</span><p className="text-2xl font-semibold">{borrower.stockIssues.length}</p></div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Serialized asset loans</h2>
        <div className="mt-3 grid gap-3">
          {borrower.assetLoans.map((loan) => (
            <article key={loan.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/loans/${loan.id}`} className="font-semibold text-slate-950 hover:underline">{loan.loanNumber}</Link>
                  <p className="text-slate-600">{loan.items.length} serialized asset{loan.items.length === 1 ? "" : "s"} / due {loan.expectedReturnAt.toLocaleDateString()}</p>
                  <p className="text-slate-500">{loan.items.slice(0, 3).map((item) => item.device.assetTag || item.device.name).join(", ")}</p>
                </div>
                <Badge className={assetLoanStatusTone[loan.status]}>{assetLoanStatusLabels[loan.status]}</Badge>
              </div>
              {["ACTIVE", "OVERDUE", "PARTIALLY_RETURNED"].includes(loan.status) ? (
                <Link href={`/loans/${loan.id}/return`} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto">
                  <RotateCcw size={16} />
                  Return assets
                </Link>
              ) : null}
            </article>
          ))}
          {borrower.assetLoans.length === 0 ? <p className="text-sm text-slate-500">No serialized asset loans for this borrower yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Stock loans / handouts</h2>
        <div className="mt-3 grid gap-3">
          {borrower.stockIssues.map((issue) => (
            <article key={issue.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/stock/issues/${issue.id}`} className="font-semibold text-slate-950 hover:underline">{issue.stockItem.name}</Link>
                  <p className="text-slate-600">{stockIssueTypeLabels[issue.issueType]} / {issue.quantity} issued / {issue.returnedQuantity} returned</p>
                  <p className="text-slate-500">{issue.issuedAt.toLocaleDateString()} {issue.expectedReturnAt ? `/ due ${issue.expectedReturnAt.toLocaleDateString()}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={stockIssueStatusTone[issue.status]}>{stockIssueStatusLabels[issue.status]}</Badge>
                  {isStockLoanOverdue(issue) ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Overdue</Badge> : null}
                </div>
              </div>
              {issue.issueType === "LOAN" && !["RETURNED", "CANCELLED"].includes(issue.status) ? (
                <Link href={`/stock/issues/${issue.id}/return`} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto">
                  <RotateCcw size={16} />
                  Return loan
                </Link>
              ) : null}
            </article>
          ))}
          {borrower.stockIssues.length === 0 ? <p className="text-sm text-slate-500">No stock issues for this borrower yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
