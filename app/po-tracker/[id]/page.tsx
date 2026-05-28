import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { WorkspaceStatusButton } from "@/components/workspace-status-button";
import { purchaseNoteStatusLabels, purchaseNoteStatusTone, taskPriorityLabels, taskPriorityTone } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PoTrackerDetailPage({ params }: Props) {
  const { id } = await params;
  const [note, activity] = await Promise.all([
    prisma.purchaseNote.findUnique({ where: { id }, include: { relatedFactura: true, items: { include: { relatedStockItem: true, relatedDevice: true } } } }),
    prisma.activityLog.findMany({ where: { entity: "purchase-note", entityId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  if (!note) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={note.title}
        description={`${note.poNumber || "No PO number"}${note.vendorName ? ` - ${note.vendorName}` : ""}`}
        action={<Link href={`/po-tracker/${note.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Edit size={16} />Edit</Link>}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={purchaseNoteStatusTone[note.status]}>{purchaseNoteStatusLabels[note.status]}</Badge>
          {note.priority ? <Badge className={taskPriorityTone[note.priority]}>{taskPriorityLabels[note.priority]}</Badge> : null}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["PO number", note.poNumber || "-"],
            ["Vendor", note.vendorName || "-"],
            ["Requested by", note.requestedBy || "-"],
            ["Estimated amount", note.estimatedAmount != null ? `${note.currency || "USD"} ${note.estimatedAmount.toFixed(2)}` : "-"],
            ["Requested", note.requestedAt ? note.requestedAt.toLocaleDateString() : "-"],
            ["Approved", note.approvedAt ? note.approvedAt.toLocaleDateString() : "-"],
            ["Ordered", note.orderedAt ? note.orderedAt.toLocaleDateString() : "-"],
            ["Expected delivery", note.expectedDeliveryAt ? note.expectedDeliveryAt.toLocaleDateString() : "-"],
            ["Received", note.receivedAt ? note.receivedAt.toLocaleDateString() : "-"],
            ["Follow up", note.followUpDate ? note.followUpDate.toLocaleDateString() : "-"],
          ].map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 p-3"><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd></div>)}
        </dl>
        {note.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{note.notes}</p> : null}
        {note.relatedFactura ? <Link href={`/facturas/${note.relatedFactura.id}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:w-auto">Open linked factura {note.relatedFactura.facturaNumber}</Link> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Actions</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <WorkspaceStatusButton endpoint={`/api/po-tracker/${note.id}`} status="ORDERED">Ordered</WorkspaceStatusButton>
          <WorkspaceStatusButton endpoint={`/api/po-tracker/${note.id}`} status="PARTIALLY_RECEIVED">Partial</WorkspaceStatusButton>
          <WorkspaceStatusButton endpoint={`/api/po-tracker/${note.id}`} status="RECEIVED" variant="primary">Received</WorkspaceStatusButton>
          <WorkspaceStatusButton endpoint={`/api/po-tracker/${note.id}`} status="FACTURA_PENDING">Factura pending</WorkspaceStatusButton>
          <WorkspaceStatusButton endpoint={`/api/po-tracker/${note.id}`} status="CLOSED">Close</WorkspaceStatusButton>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Requested items</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {note.items.map((item) => (
            <div key={item.id} className="py-3 text-sm">
              <p className="font-medium text-slate-950">{item.description}</p>
              <p className="text-slate-500">Qty {item.quantity ?? "-"}{item.unitCost != null ? ` - ${note.currency || "USD"} ${item.unitCost.toFixed(2)}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.relatedStockItem ? <Link className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" href={`/stock/${item.relatedStockItem.id}`}>{item.relatedStockItem.name}</Link> : null}
                {item.relatedDevice ? <Link className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" href={`/devices/${item.relatedDevice.id}`}>{item.relatedDevice.name}</Link> : null}
              </div>
            </div>
          ))}
          {note.items.length === 0 ? <p className="text-sm text-slate-500">No requested item lines yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Activity</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {activity.map((item) => <div key={item.id} className="py-3 text-sm"><p className="font-medium text-slate-950">{item.message}</p><p className="text-slate-500">{item.createdAt.toLocaleString()}</p></div>)}
          {activity.length === 0 ? <p className="text-sm text-slate-500">No PO tracker activity yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
