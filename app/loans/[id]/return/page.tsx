import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AssetLoanReturnForm } from "@/components/asset-loan-return-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

type Context = { params: Promise<{ id: string }> };

export default async function ReturnLoanPage({ params }: Context) {
  if (!(await hasPagePermission("loans.write"))) return <ForbiddenPanel message="Returning asset loans requires IT Staff or Admin access." />;
  const { id } = await params;
  const loan = await prisma.assetLoan.findUnique({ where: { id }, include: { items: { include: { device: true } } } });
  if (!loan) notFound();
  const pending = loan.items.filter((item) => item.returnStatus === "PENDING");

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/loans/${loan.id}`} className="text-sm font-semibold text-slate-600 hover:text-slate-950">{loan.loanNumber}</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Return Loaned Assets</h1>
        <p className="mt-1 text-sm text-slate-500">Receive one or more serialized assets. Good/Fair returns become available; damaged or missing items are moved out of daily use.</p>
      </div>
      {pending.length ? <AssetLoanReturnForm loan={loan} /> : <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">All assets on this loan have already been returned.</div>}
    </div>
  );
}
