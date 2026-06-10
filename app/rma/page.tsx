import Link from "next/link";
import { PackageCheck, Plus, Search } from "lucide-react";
import type { Prisma, RmaCaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { ActionLink, PageActions } from "@/components/ui-patterns";
import { activeRmaStatuses, daysActive } from "@/lib/rma";
import { rmaCaseStatusLabels, rmaCaseStatusTone } from "@/lib/constants";
import { RmaRefreshButton } from "@/components/rma-refresh-button";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ q?: string; status?: string; followUpDue?: string }> };

export default async function RmaListPage({ searchParams }: Props) {
  if (!(await hasPagePermission("rma.write"))) return <ForbiddenPanel message="RMA repair workflows require IT Staff or Admin access." />;
  const query = searchParams ? await searchParams : {};
  const q = query.q?.trim();
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const where: Prisma.RmaCaseWhereInput = {
    ...(query.status === "active" ? { status: { in: activeRmaStatuses } } : query.status ? { status: query.status as RmaCaseStatus } : {}),
    ...(query.followUpDue === "true" ? { status: { in: activeRmaStatuses }, expectedFollowUpAt: { lte: today } } : {}),
    ...(q
      ? {
          OR: [
            { rmaNumber: { contains: q } },
            { title: { contains: q } },
            { destination: { contains: q } },
            { vendorName: { contains: q } },
            { trackingNumber: { contains: q } },
            { items: { some: { device: { OR: [{ assetTag: { contains: q } }, { serialNumber: { contains: q } }, { model: { contains: q } }, { name: { contains: q } }] } } } },
          ],
        }
      : {}),
  };

  const [cases, activeCount, followUpDue, devicesInRma] = await Promise.all([
    prisma.rmaCase.findMany({ where, include: { items: { include: { device: true } } }, orderBy: [{ status: "asc" }, { expectedFollowUpAt: "asc" }, { updatedAt: "desc" }] }),
    prisma.rmaCase.count({ where: { status: { in: activeRmaStatuses } } }),
    prisma.rmaCase.count({ where: { status: { in: activeRmaStatuses }, expectedFollowUpAt: { lte: today } } }),
    prisma.rmaItem.count({ where: { result: "PENDING", rmaCase: { status: { in: activeRmaStatuses } } } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RMA / Repair"
        description="Batch-send devices to repair, track follow-ups, and receive returned items without losing assignment history."
        action={
          <PageActions>
            <ActionLink href="/rma/active">Active</ActionLink>
            <ActionLink href="/rma/new" variant="primary"><Plus size={16} />New RMA</ActionLink>
          </PageActions>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary label="Active RMAs" value={activeCount} helper="Sent or partially returned" />
        <Summary label="Follow-ups due" value={followUpDue} helper="Manual refresh can create alerts" tone={followUpDue ? "border-amber-200 bg-amber-50" : ""} />
        <Summary label="Devices in RMA" value={devicesInRma} helper="Pending repair items" />
      </section>

      <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Search
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-4 text-slate-400" size={18} />
              <input className="min-h-14 w-full rounded-md border border-slate-300 px-10 text-base sm:min-h-12 sm:text-sm" name="q" defaultValue={q ?? ""} placeholder="RMA, vendor, tracking, asset tag, serial" />
            </span>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Status
            <select className="min-h-14 w-full rounded-md border border-slate-300 px-3 text-base sm:min-h-12 sm:text-sm" name="status" defaultValue={query.status ?? ""}>
              <option value="">All</option>
              <option value="active">Active group</option>
              {Object.entries(rmaCaseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-5 font-semibold text-white sm:self-end">Filter</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/rma?followUpDue=true" className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Follow-up due</Link>
          <RmaRefreshButton />
        </div>
      </form>

      <section className="grid gap-3 xl:grid-cols-2">
        {cases.map((rma) => {
          const pending = rma.items.filter((item) => item.result === "PENDING").length;
          const returned = rma.items.length - pending;
          const due = rma.expectedFollowUpAt && rma.expectedFollowUpAt <= today;
          return (
            <article key={rma.id} className={`rounded-lg border bg-white p-4 shadow-sm ${due ? "border-amber-200" : "border-slate-200"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">RMA {rma.rmaNumber}</h2>
                    <Badge className={rmaCaseStatusTone[rma.status]}>{rmaCaseStatusLabels[rma.status]}</Badge>
                    {due ? <Badge className="bg-amber-100 text-amber-900 ring-amber-200">Follow-up due</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{rma.title || `${rma.destination}${rma.vendorName ? ` / ${rma.vendorName}` : ""}`}</p>
                </div>
                <ActionLink href={`/rma/${rma.id}`}>Open</ActionLink>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <Metric label="Devices" value={rma.items.length} />
                <Metric label="Pending" value={pending} />
                <Metric label="Returned" value={returned} />
                <Metric label="Days active" value={daysActive(rma.sentAt)} />
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Sent" value={dateText(rma.sentAt) || "Not sent"} />
                <Info label="Follow-up" value={dateText(rma.expectedFollowUpAt) || "No date"} />
                <Info label="Carrier" value={[rma.carrier, rma.trackingNumber].filter(Boolean).join(" / ") || "Not set"} />
                <Info label="Destination" value={rma.destination} />
              </div>
            </article>
          );
        })}
        {cases.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            <PackageCheck className="mx-auto mb-2 text-slate-400" />
            No RMA cases match this view.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Summary({ label, value, helper, tone = "border-slate-200 bg-white" }: { label: string; value: number; helper: string; tone?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
      <p className="mt-4 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 break-words font-medium text-slate-950">{value}</p></div>;
}

function dateText(value?: Date | null) {
  return value ? value.toLocaleDateString() : "";
}
