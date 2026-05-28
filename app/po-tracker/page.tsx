import Link from "next/link";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { WorkspaceStatusButton } from "@/components/workspace-status-button";
import { purchaseNoteStatusLabels, purchaseNoteStatusOptions, purchaseNoteStatusTone, taskPriorityLabels, taskPriorityTone } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PoTrackerPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const vendor = typeof params.vendor === "string" ? params.vendor.trim() : "";
  const followUpDue = params.followUpDue === "true";
  const facturaPending = params.facturaPending === "true";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const purchaseNotes = await prisma.purchaseNote.findMany({
    where: {
      ...(q ? { OR: [{ poNumber: { contains: q } }, { title: { contains: q } }, { vendorName: { contains: q } }, { notes: { contains: q } }] } : {}),
      ...(status ? { status: status as never } : {}),
      ...(vendor ? { vendorName: { contains: vendor } } : {}),
      ...(followUpDue ? { followUpDate: { lte: today }, status: { notIn: ["CLOSED", "CANCELLED"] } } : {}),
      ...(facturaPending ? { status: "FACTURA_PENDING" } : {}),
    },
    include: { relatedFactura: true, items: true },
    orderBy: [{ status: "asc" }, { followUpDate: "asc" }, { updatedAt: "desc" }],
  });

  const activeFilters = [
    status ? purchaseNoteStatusLabels[status as keyof typeof purchaseNoteStatusLabels] : null,
    vendor ? `Vendor: ${vendor}` : null,
    followUpDue ? "Follow-up due" : null,
    facturaPending ? "Factura pending" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="PO Tracker"
        description="Lightweight purchase-order notes, vendor follow-ups, and factura status."
        action={<Link href="/po-tracker/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={16} />New PO note</Link>}
      />

      <form className="sticky top-[73px] z-20 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:static lg:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={18} />
            <input name="q" defaultValue={q} className="min-h-14 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base sm:min-h-12" placeholder="Search PO, vendor, notes" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 font-semibold text-white sm:min-h-12">Search</button>
        </div>
        {activeFilters.length ? <div className="flex flex-wrap gap-2">{activeFilters.map((filter) => <span key={filter} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{filter}</span>)}<Link href="/po-tracker" className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">Clear</Link></div> : null}
        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Filters</span>
            <span className="text-xs text-slate-500">{activeFilters.length ? `${activeFilters.length} active` : "Optional"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2">
            <select name="status" defaultValue={status} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base"><option value="">All statuses</option>{purchaseNoteStatusOptions.map((option) => <option key={option} value={option}>{purchaseNoteStatusLabels[option]}</option>)}</select>
            <input name="vendor" defaultValue={vendor} className="min-h-12 rounded-md border border-slate-300 px-3 text-base" placeholder="Vendor" />
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><input name="followUpDue" value="true" type="checkbox" defaultChecked={followUpDue} />Follow-up due</label>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><input name="facturaPending" value="true" type="checkbox" defaultChecked={facturaPending} />Factura pending</label>
            <button className="min-h-12 rounded-md bg-slate-950 px-4 font-semibold text-white md:col-span-2">Apply filters</button>
          </div>
        </details>
      </form>

      <section className="grid gap-3">
        {purchaseNotes.map((note) => (
          <article key={note.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">{note.poNumber || "No PO number"}</p>
                <h2 className="mt-1 font-semibold text-slate-950">{note.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{note.vendorName || "No vendor"}{note.expectedDeliveryAt ? ` - Expected ${note.expectedDeliveryAt.toLocaleDateString()}` : ""}</p>
              </div>
              <Badge className={purchaseNoteStatusTone[note.status]}>{purchaseNoteStatusLabels[note.status]}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {note.priority ? <Badge className={taskPriorityTone[note.priority]}>{taskPriorityLabels[note.priority]}</Badge> : null}
              {note.followUpDate ? <Badge className="bg-amber-100 text-amber-900 ring-amber-200">Follow up {note.followUpDate.toLocaleDateString()}</Badge> : null}
              {note.relatedFactura ? <Badge className="bg-blue-100 text-blue-800 ring-blue-200">{note.relatedFactura.facturaNumber}</Badge> : note.status === "FACTURA_PENDING" ? <Badge className="bg-orange-100 text-orange-900 ring-orange-200">Factura needed</Badge> : null}
            </div>
            {note.notes ? <p className="mt-3 line-clamp-2 text-sm text-slate-600">{note.notes}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link href={`/po-tracker/${note.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">Open</Link>
              <Link href={`/po-tracker/${note.id}/edit`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">Edit</Link>
              <WorkspaceStatusButton endpoint={`/api/po-tracker/${note.id}`} status="RECEIVED">Received</WorkspaceStatusButton>
              <WorkspaceStatusButton endpoint={`/api/po-tracker/${note.id}`} status="FACTURA_PENDING">Factura pending</WorkspaceStatusButton>
            </div>
          </article>
        ))}
      </section>

      {purchaseNotes.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No PO tracker notes match this view.</p> : null}
    </div>
  );
}
