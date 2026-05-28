import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FacturaDetailPage({ params }: Props) {
  const { id } = await params;
  const factura = await prisma.factura.findUnique({
    where: { id },
    include: {
      assets: { orderBy: { name: "asc" }, include: { photos: true } },
      stockItems: { orderBy: { name: "asc" } },
      stockMovements: { include: { stockItem: true, asset: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!factura) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={factura.facturaNumber}
        description={`${factura.vendorName}${factura.poNumber ? ` • PO ${factura.poNumber}` : ""}`}
        action={
          <Link href={`/facturas/${factura.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Edit size={16} />
            Edit
          </Link>
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
    </div>
  );
}
