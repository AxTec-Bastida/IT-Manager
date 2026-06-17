import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Edit, FileText, Link2, Plus, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { hasPagePermission } from "@/lib/page-permissions";
import { categoryLabels } from "@/lib/constants";
import { unlinkedQuantity } from "@/lib/factura-line-items";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FacturaDetailPage({ params }: Props) {
  const [canWriteInventory, canWriteTasks] = await Promise.all([hasPagePermission("inventory.write"), hasPagePermission("tasks.write")]);
  const { id } = await params;
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      assets: { orderBy: { name: "asc" }, include: { photos: true } },
      stockItems: { orderBy: { name: "asc" } },
      stockMovements: { include: { stockItem: true, asset: true }, orderBy: { createdAt: "desc" } },
      lineItems: { include: { assetLinks: { include: { device: true } } }, orderBy: { createdAt: "asc" } },
      purchaseNotes: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!factura) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={factura.facturaNumber}
        description={`${factura.vendorName}${factura.poNumber ? ` • PO ${factura.poNumber}` : ""}`}
        action={
          <div className="grid gap-2 sm:flex">
            {canWriteTasks ? <Link href={`/tasks/new?relatedFacturaId=${factura.id}&category=PURCHASE&title=${encodeURIComponent(`Follow up ${factura.facturaNumber}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ClipboardList size={16} />
              Create Task
            </Link> : null}
            <Link href={`/po-tracker/new?relatedFacturaId=${factura.id}&poNumber=${encodeURIComponent(factura.poNumber || "")}&title=${encodeURIComponent(`PO note for ${factura.facturaNumber}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ReceiptText size={16} />
              PO Note
            </Link>
            {canWriteInventory ? <Link href={`/facturas/${factura.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Edit size={16} />
              Edit
            </Link> : null}
            {canWriteInventory ? <Link href={`/facturas/${factura.id}/line-items/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
              <Plus size={16} />
              Add Line Item
            </Link> : null}
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Vendor", factura.vendorName],
              ["Vendor RFC", factura.vendorRfc || "-"],
              ["Purchase date", factura.purchaseDate ? factura.purchaseDate.toLocaleDateString() : "-"],
              ["Received date", factura.receivedDate ? factura.receivedDate.toLocaleDateString() : "-"],
              ["PO number", factura.poNumber || "-"],
              ["Total", factura.totalAmount != null ? `${factura.currency} ${factura.totalAmount.toFixed(2)}` : "-"],
              ["Warranty start", factura.warrantyStartAt ? factura.warrantyStartAt.toLocaleDateString() : "-"],
              ["Warranty end", factura.warrantyEndAt ? factura.warrantyEndAt.toLocaleDateString() : "-"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
          {factura.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{factura.notes}</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Attachment</h2>
          {factura.filePath ? (
            <a href={factura.filePath} target="_blank" className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <FileText size={17} />
              Open factura file
            </a>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No file attached.</p>
          )}
          {factura.originalFilename ? <p className="mt-2 break-all text-xs text-slate-500">{factura.originalFilename}</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Line Items</h2>
            <p className="mt-1 text-sm text-slate-600">Manual structured factura rows for asset value matching. No OCR or PDF extraction.</p>
          </div>
          {canWriteInventory ? (
            <Link href={`/facturas/${factura.id}/line-items/new`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Plus size={16} />
              Add line item
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {factura.lineItems.map((lineItem) => {
            const remaining = unlinkedQuantity(lineItem);
            return (
              <div key={lineItem.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Line item</p>
                    <h3 className="text-lg font-semibold text-slate-950">{lineItem.description}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {[lineItem.sku, lineItem.model, lineItem.category ? categoryLabels[lineItem.category] : ""].filter(Boolean).join(" / ") || "No SKU/model/category"}
                    </p>
                  </div>
                  <div className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                    {lineItem.assetLinks.length} / {lineItem.quantity} linked
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md bg-white p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Unit cost</p>
                    <p className="mt-1 font-semibold text-slate-950">{lineItem.currency} {lineItem.unitCost.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Total</p>
                    <p className="mt-1 font-semibold text-slate-950">{lineItem.currency} {lineItem.totalCost.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Unlinked qty</p>
                    <p className="mt-1 font-semibold text-slate-950">{remaining}</p>
                  </div>
                </div>
                {lineItem.assetLinks.length ? (
                  <div className="mt-3 grid gap-2">
                    {lineItem.assetLinks.slice(0, 5).map((link) => (
                      <Link key={link.id} href={`/devices/${link.deviceId}`} className="rounded-md bg-white p-3 text-sm hover:bg-slate-100">
                        <span className="font-semibold text-slate-950">{link.device.assetTag || link.device.name}</span>
                        <span className="text-slate-500"> / {link.device.serialNumber || "No serial"}</span>
                      </Link>
                    ))}
                    {lineItem.assetLinks.length > 5 ? <p className="text-xs text-slate-500">+{lineItem.assetLinks.length - 5} more linked assets</p> : null}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {canWriteInventory ? <Link href={`/facturas/${factura.id}/line-items/${lineItem.id}/link-assets`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"><Link2 size={16} />Link / Apply</Link> : null}
                  {canWriteInventory ? <Link href={`/facturas/${factura.id}/line-items/${lineItem.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Edit</Link> : null}
                </div>
              </div>
            );
          })}
          {!factura.lineItems.length ? <p className="text-sm text-slate-500">No structured line items yet.</p> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Linked assets</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {factura.assets.map((asset) => (
              <Link key={asset.id} href={`/devices/${asset.id}`} className="block py-3 text-sm hover:bg-slate-50">
                <p className="font-medium text-slate-950">{asset.assetTag ? `${asset.assetTag} - ` : ""}{asset.name}</p>
                <p className="text-slate-500">{asset.serialNumber || "No serial"} • {asset.photos.length} photo(s)</p>
              </Link>
            ))}
            {factura.assets.length === 0 ? <p className="text-sm text-slate-500">No assets linked.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Linked stock</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {factura.stockItems.map((item) => (
              <Link key={item.id} href={`/stock/${item.id}`} className="block py-3 text-sm hover:bg-slate-50">
                <p className="font-medium text-slate-950">{item.sku ? `${item.sku} - ` : ""}{item.name}</p>
                <p className="text-slate-500">{item.quantityOnHand} on hand</p>
              </Link>
            ))}
            {factura.stockItems.length === 0 ? <p className="text-sm text-slate-500">No stock items linked.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Linked stock movements</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {factura.stockMovements.map((movement) => (
            <div key={movement.id} className="py-3 text-sm">
              <p className="font-medium text-slate-950">{movement.stockItem.name}</p>
              <p className="text-slate-500">{movement.movementType.replaceAll("_", " ")} • {movement.previousQuantity} to {movement.newQuantity}</p>
            </div>
          ))}
          {factura.stockMovements.length === 0 ? <p className="text-sm text-slate-500">No stock movements linked.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Related PO tracker notes</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {factura.purchaseNotes.map((note) => (
            <Link key={note.id} href={`/po-tracker/${note.id}`} className="block py-3 text-sm hover:bg-slate-50">
              <p className="font-medium text-slate-950">{note.poNumber ? `${note.poNumber} - ` : ""}{note.title}</p>
              <p className="text-slate-500">{note.status.replaceAll("_", " ")}</p>
            </Link>
          ))}
          {factura.purchaseNotes.length === 0 ? <p className="text-sm text-slate-500">No PO tracker notes linked to this factura yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
