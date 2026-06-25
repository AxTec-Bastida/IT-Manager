import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/badge";
import { EmailActionButton } from "@/components/email-action-button";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import {
  assetLoanItemReturnStatusLabels,
  assetLoanItemReturnStatusTone,
  assetLoanStatusLabels,
  assetLoanStatusTone,
  categoryLabels,
  conditionLabels,
  statusLabels,
} from "@/lib/constants";
import { activeAssetLoanStatuses, borrowerLabel, isAssetLoanOverdue } from "@/lib/asset-loans";
import { hasPagePermission } from "@/lib/page-permissions";

type Context = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emailWarning?: string }>;
};

export default async function LoanDetailPage({ params, searchParams }: Context) {
  if (!(await hasPagePermission("loans.write"))) return <ForbiddenPanel message="Asset loan records require IT Staff or Admin access." />;
  const { id } = await params;
  const { emailWarning } = await searchParams;
  const showEmailSkippedWarning = emailWarning === "skipped";

  const loan = await prisma.assetLoan.findUnique({ where: { id }, include: { employee: true, temporaryBorrower: true, items: { include: { device: true } } } });
  if (!loan) notFound();
  const displayStatus = isAssetLoanOverdue(loan) ? "OVERDUE" : loan.status;
  const pending = loan.items.filter((item) => item.returnStatus === "PENDING");
  const recipient = loan.employee?.email || loan.temporaryBorrower?.email || "";

  return (
    <div className="space-y-5">
      {showEmailSkippedWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3 shadow-sm">
          <div className="shrink-0 text-amber-700 font-semibold text-lg">⚠️</div>
          <div>
            <p className="font-semibold text-amber-950">Loan created</p>
            <p className="mt-0.5 text-amber-800">Email skipped because SMTP is not configured.</p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/loans" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Asset Loans</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{loan.loanNumber}</h1>
            <Badge className={assetLoanStatusTone[displayStatus]}>{assetLoanStatusLabels[displayStatus]}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{borrowerLabel(loan)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/loans/${loan.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700">
            <Edit size={16} />
            Edit
          </Link>
          {activeAssetLoanStatuses.includes(loan.status) && pending.length ? (
            <Link href={`/loans/${loan.id}/return`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">
              <RotateCcw size={16} />
              Return Assets
            </Link>
          ) : null}
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Total assets" value={loan.items.length} />
        <Metric label="Pending" value={pending.length} />
        <Metric label="Returned" value={loan.items.length - pending.length} />
        <Metric label="Due" value={dateLabel(loan.expectedReturnAt)} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Loan details</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Borrower" value={borrowerLabel(loan)} />
          <Info label="Loaned by" value={loan.loanedBy || "Not recorded"} />
          <Info label="Start" value={dateLabel(loan.loanStartAt)} />
          <Info label="Expected return" value={dateLabel(loan.expectedReturnAt)} />
          <Info label="Actual return" value={loan.actualReturnAt ? dateLabel(loan.actualReturnAt) : "Not returned"} />
          <Info label="Terms accepted" value={loan.termsAccepted ? "Yes" : "No"} />
        </dl>
        {loan.checkoutNotes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{loan.checkoutNotes}</p> : null}
        {loan.returnNotes ? <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{loan.returnNotes}</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Email receipts</h2>
        <p className="mt-1 text-sm text-slate-500">Manual sends are logged and never change the saved loan record if SMTP fails.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EmailActionButton endpoint={`/api/loans/${loan.id}/email`} kind="checkout" label="Send checkout receipt" defaultRecipient={recipient} />
          {loan.actualReturnAt || pending.length < loan.items.length ? <EmailActionButton endpoint={`/api/loans/${loan.id}/email`} kind="return" label="Send return confirmation" defaultRecipient={recipient} /> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Loaned assets</h2>
        <div className="mt-4 grid gap-3">
          {loan.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/devices/${item.deviceId}`} className="font-semibold text-slate-950 hover:underline">{item.device.name}</Link>
                    <Badge className={assetLoanItemReturnStatusTone[item.returnStatus]}>{assetLoanItemReturnStatusLabels[item.returnStatus]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.device.assetTag || "No tag"} / {item.device.serialNumber || "No serial"}</p>
                  <p className="text-sm text-slate-500">{categoryLabels[item.device.category]} / {statusLabels[item.device.status]}</p>
                </div>
                <div className="text-sm text-slate-500 sm:text-right">
                  <p>Out: {item.conditionOut ? conditionLabels[item.conditionOut] : "Not recorded"}</p>
                  <p>In: {item.conditionIn ? item.conditionIn.replaceAll("_", " ") : "Pending"}</p>
                </div>
              </div>
              {item.accessoriesOut || item.accessoriesReturned || item.returnNotes ? (
                <p className="mt-2 text-sm text-slate-600">Accessories: {item.accessoriesReturned || item.accessoriesOut || "None"} {item.returnNotes ? `- ${item.returnNotes}` : ""}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}
