import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TemporaryBorrowersPage({ searchParams }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Temporary borrower stock workflows require IT Staff or Admin access." />;
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const showInactive = params.showInactive === "true";
  const where: Prisma.TemporaryBorrowerWhereInput = {
    ...(showInactive ? {} : { active: true }),
    ...(q ? { OR: [{ tempId: { contains: q } }, { name: { contains: q } }, { department: { contains: q } }, { area: { contains: q } }, { supervisorName: { contains: q } }] } : {}),
  };
  const borrowers = await prisma.temporaryBorrower.findMany({
    where,
    include: { stockIssues: { where: { status: { in: ["ACTIVE", "PARTIALLY_RETURNED"] } }, include: { stockItem: true } } },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Temporary Borrowers" description="Contractors, visitors, and unregistered users for temporary stock loans." action={<Link href="/temporary-borrowers/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><UserPlus size={16} />New Borrower</Link>} />
      <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={18} />
            <input className="min-h-14 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base" name="q" defaultValue={q} placeholder="Search temp ID, name, area, supervisor" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 font-semibold text-white">Search</button>
        </div>
        <label className="mt-3 flex min-h-12 items-center gap-2 rounded-md bg-slate-50 px-3 text-sm font-medium text-slate-700">
          <input name="showInactive" value="true" type="checkbox" defaultChecked={showInactive} className="size-4" />
          Show inactive borrowers
        </label>
      </form>
      <section className="grid gap-3 md:grid-cols-2">
        {borrowers.map((borrower) => (
          <article key={borrower.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-slate-500">{borrower.tempId}</p>
                <h2 className="text-lg font-semibold text-slate-950">{borrower.name}</h2>
                <p className="text-sm text-slate-600">{borrower.department || borrower.area || "No department/area"}</p>
              </div>
              <Badge className={borrower.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>{borrower.active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
              <span className="text-slate-500">Active loans</span>
              <p className="text-xl font-semibold text-slate-950">{borrower.stockIssues.length}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={`/temporary-borrowers/${borrower.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">Open</Link>
              <Link href={`/stock/issue?temporaryBorrowerId=${borrower.id}&issueType=LOAN`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Issue stock</Link>
            </div>
          </article>
        ))}
        {borrowers.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No temporary borrowers match this view.</p> : null}
      </section>
    </div>
  );
}
