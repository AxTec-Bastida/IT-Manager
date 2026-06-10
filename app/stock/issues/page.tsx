import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PackageCheck, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { stockIssueStatusLabels, stockIssueStatusTone, stockIssueTypeLabels } from "@/lib/constants";
import { isStockLoanOverdue } from "@/lib/stock-issues";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockIssuesPage({ searchParams }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Stock issue records require IT Staff or Admin access." />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const view = typeof params.view === "string" ? params.view : "";
  const where: Prisma.StockIssueWhereInput = {
    ...(view === "active" ? { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } } : {}),
    ...(view === "handouts" ? { issueType: "HANDOUT" } : {}),
    ...(view === "temporary" ? { temporaryBorrowerId: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { issueNumber: { contains: q } },
            { stockItem: { name: { contains: q } } },
            { stockItem: { sku: { contains: q } } },
            { employee: { fullName: { contains: q } } },
            { employee: { employeeId: { contains: q } } },
            { temporaryBorrower: { name: { contains: q } } },
            { temporaryBorrower: { tempId: { contains: q } } },
          ],
        }
      : {}),
  };
  const allIssues = await prisma.stockIssue.findMany({
    where,
    include: { stockItem: true, employee: true, temporaryBorrower: true },
    orderBy: [{ status: "asc" }, { expectedReturnAt: "asc" }, { issuedAt: "desc" }],
    take: 250,
  });
  const issues = view === "overdue" ? allIssues.filter((issue) => isStockLoanOverdue(issue)) : allIssues;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issue History"
        description="Receipts and history for quantity-based item handouts, active loans, returned items, and temporary borrower issues."
        action={<Link href="/stock/issue" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><PackageCheck size={16} />Issue / Loan Item</Link>}
      />

      <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={18} />
            <input className="min-h-14 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base" name="q" defaultValue={q} placeholder="Search borrower, temp ID, stock, issue number" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 font-semibold text-white">Search</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["", "All"],
            ["active", "Active loans"],
            ["handouts", "Handouts"],
            ["overdue", "Overdue"],
            ["temporary", "Temporary borrowers"],
          ].map(([hrefView, label]) => (
            <Link key={hrefView} href={`/stock/issues${hrefView ? `?view=${hrefView}` : ""}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${view === hrefView ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</Link>
          ))}
        </div>
      </form>

      <section className="grid gap-3">
        {issues.map((issue) => (
          <article key={issue.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{issue.issueNumber || issue.issueType}</p>
                <h2 className="text-lg font-semibold text-slate-950">{issue.stockItem.name}</h2>
                <p className="text-sm text-slate-600">{issue.employee?.fullName || issue.temporaryBorrower?.name || "Unknown borrower"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={stockIssueStatusTone[issue.status]}>{stockIssueStatusLabels[issue.status]}</Badge>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{stockIssueTypeLabels[issue.issueType]}</Badge>
                {isStockLoanOverdue(issue) ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Overdue</Badge> : null}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Issued</span><p className="font-semibold">{issue.quantity}</p></div>
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Returned</span><p className="font-semibold">{issue.returnedQuantity}</p></div>
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Issued date</span><p className="font-semibold">{issue.issuedAt.toLocaleDateString()}</p></div>
              <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Due</span><p className="font-semibold">{issue.expectedReturnAt?.toLocaleDateString() || "-"}</p></div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={`/stock/issues/${issue.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">Open</Link>
              {issue.issueType === "LOAN" && issue.status !== "RETURNED" && issue.status !== "CANCELLED" ? <Link href={`/stock/issues/${issue.id}/return`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Return loan</Link> : null}
            </div>
          </article>
        ))}
        {issues.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No stock issues match this view.</p> : null}
      </section>
    </div>
  );
}
