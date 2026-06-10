import Link from "next/link";
import { ClipboardList, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { assetLoanStatusLabels, assetLoanStatusTone } from "@/lib/constants";
import { activeAssetLoanStatuses, borrowerLabel, isAssetLoanOverdue } from "@/lib/asset-loans";
import { hasPagePermission } from "@/lib/page-permissions";

export default async function LoansPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await hasPagePermission("loans.write"))) return <ForbiddenPanel message="Asset loan workflows require IT Staff or Admin access." />;
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const view = typeof params.view === "string" ? params.view : "";
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const loans = await prisma.assetLoan.findMany({
    where: {
      ...(view === "active" ? { status: { in: activeAssetLoanStatuses } } : {}),
      ...(view === "overdue" ? { status: { in: activeAssetLoanStatuses }, expectedReturnAt: { lt: todayStart } } : {}),
      ...(q
        ? {
            OR: [
              { loanNumber: { contains: q } },
              { employee: { fullName: { contains: q } } },
              { temporaryBorrower: { name: { contains: q } } },
              { items: { some: { device: { OR: [{ name: { contains: q } }, { assetTag: { contains: q } }, { serialNumber: { contains: q } }] } } } },
            ],
          }
        : {}),
    },
    include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } },
    orderBy: [{ status: "asc" }, { expectedReturnAt: "asc" }, { updatedAt: "desc" }],
  });

  const activeCount = loans.filter((loan) => activeAssetLoanStatuses.includes(loan.status)).length;
  const overdueCount = loans.filter((loan) => isAssetLoanOverdue(loan)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Warehouse IT</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Asset Loans</h1>
          <p className="mt-1 text-sm text-slate-500">Temporary checkout for serialized assets. Assignments and stock issues stay separate.</p>
        </div>
        <div className="grid gap-2 sm:flex">
          <Link href="/loans/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
            <Plus size={16} />
            Advanced form
          </Link>
          <Link href="/loans/quick-checkout" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
            <ClipboardList size={16} />
            Quick Checkout
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Active loans" value={activeCount} href="/loans?view=active" />
        <SummaryCard label="Overdue" value={overdueCount} href="/loans?view=overdue" urgent={overdueCount > 0} />
        <SummaryCard label="Visible loans" value={loans.length} href="/loans" />
      </div>

      <form className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-4 text-slate-400" size={18} />
          <input className="min-h-14 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base" name="q" defaultValue={q} placeholder="Search loan, borrower, tag, serial" />
        </label>
        <button className="inline-flex min-h-14 items-center justify-center rounded-md border border-slate-300 px-4 font-semibold text-slate-700">Search</button>
      </form>

      <div className="grid gap-3">
        {loans.map((loan) => {
          const pending = loan.items.filter((item) => item.returnStatus === "PENDING").length;
          return (
            <Link key={loan.id} href={`/loans/${loan.id}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950">{loan.loanNumber}</h2>
                    <Badge className={assetLoanStatusTone[isAssetLoanOverdue(loan) ? "OVERDUE" : loan.status]}>{assetLoanStatusLabels[isAssetLoanOverdue(loan) ? "OVERDUE" : loan.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{borrowerLabel(loan)}</p>
                  <p className="mt-1 text-sm text-slate-500">{loan.items.length} asset{loan.items.length === 1 ? "" : "s"} / {pending} pending</p>
                </div>
                <div className="text-sm text-slate-500 sm:text-right">
                  <p>Due {dateLabel(loan.expectedReturnAt)}</p>
                  <p>Started {dateLabel(loan.loanStartAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {loan.items.slice(0, 4).map((item) => <Badge key={item.id} className="bg-slate-100 text-slate-700 ring-slate-200">{item.device.assetTag || item.device.name}</Badge>)}
                {loan.items.length > 4 ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">+{loan.items.length - 4}</Badge> : null}
              </div>
            </Link>
          );
        })}
        {!loans.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No asset loans found.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, href, urgent = false }: { label: string; value: number; href: string; urgent?: boolean }) {
  return (
    <Link href={href} className={`rounded-lg border p-4 ${urgent ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </Link>
  );
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}
