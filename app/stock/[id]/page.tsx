import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit, PackagePlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { StockMovementForm } from "@/components/stock-movement-form";
import { categoryLabels, stockCategoryLabels, stockItemTypeLabels, stockMovementTypeLabels } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StockDetailPage({ params }: Props) {
  const { id } = await params;
  const [stockItem, employees, facturas] = await Promise.all([
    prisma.stockItem.findUnique({
      where: { id },
      include: {
        factura: true,
        movements: { orderBy: { createdAt: "desc" }, take: 25, include: { asset: true, employee: true, factura: true } },
        maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 25, include: { asset: true } },
        alerts: { where: { status: "OPEN" }, orderBy: { lastSeenAt: "desc" } },
      },
    }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  if (!stockItem) notFound();

  const lowStock = stockItem.quantityOnHand <= stockItem.minimumQuantity;

  return (
    <div className="space-y-6">
      <PageHeader
        title={stockItem.name}
        description={`${stockCategoryLabels[stockItem.category]} • ${stockItemTypeLabels[stockItem.itemType]}`}
        action={
          <Link href={`/stock/${stockItem.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Edit size={16} />
            Edit
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {lowStock ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Low stock</Badge> : <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">In stock</Badge>}
            {!stockItem.active ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Inactive</Badge> : null}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["SKU", stockItem.sku || "-"],
              ["Quantity on hand", stockItem.quantityOnHand],
              ["Minimum quantity", stockItem.minimumQuantity],
              ["Reorder quantity", stockItem.reorderQuantity ?? "-"],
              ["Storage location", stockItem.storageLocation || "-"],
              ["Vendor", stockItem.vendorName || "-"],
              ["Factura", stockItem.factura ? `${stockItem.factura.facturaNumber} - ${stockItem.factura.vendorName}` : "-"],
              ["Unit cost", stockItem.unitCost != null ? `${stockItem.currency || "USD"} ${stockItem.unitCost.toFixed(2)}` : "-"],
              ["Compatible category", stockItem.compatibleAssetCategory ? categoryLabels[stockItem.compatibleAssetCategory] : "Any"],
              ["Compatible models", stockItem.compatibleModels || "-"],
              ["Updated", stockItem.updatedAt.toLocaleString()],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd>
              </div>
            ))}
          </dl>
          {stockItem.notes ? <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{stockItem.notes}</p> : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-950">
            <PackagePlus size={18} />
            Quantity actions
          </h2>
          <p className="mt-1 text-sm text-slate-500">Every change creates a stock movement history row.</p>
          <div className="mt-4">
            <StockMovementForm stockItem={stockItem} employees={employees} facturas={facturas} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Usage history</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {stockItem.movements.map((movement) => (
              <div key={movement.id} className="py-3 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-slate-950">{stockMovementTypeLabels[movement.movementType]}</p>
                  <p className="text-slate-500">{movement.createdAt.toLocaleString()}</p>
                </div>
                <p className="text-slate-600">
                  {movement.previousQuantity} → {movement.newQuantity} ({movement.quantity})
                  {movement.asset ? ` • ${movement.asset.name}` : ""}
                  {movement.employee ? ` • ${movement.employee.fullName}` : ""}
                  {movement.factura ? ` • ${movement.factura.facturaNumber}` : ""}
                </p>
                {movement.notes ? <p className="text-slate-500">{movement.notes}</p> : null}
              </div>
            ))}
            {stockItem.movements.length === 0 ? <p className="text-sm text-slate-500">No stock movement history yet.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">Linked maintenance</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {stockItem.maintenanceRecords.map((record) => (
              <Link key={record.id} href={`/devices/${record.assetId}`} className="block py-3 text-sm hover:bg-slate-50">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-slate-950">{record.asset.name}</p>
                  <p className="text-slate-500">{record.performedAt.toLocaleString()}</p>
                </div>
                <p className="text-slate-600">{record.maintenanceType.replaceAll("_", " ")} • Qty {record.quantityUsed ?? 0}</p>
              </Link>
            ))}
            {stockItem.maintenanceRecords.length === 0 ? <p className="text-sm text-slate-500">No maintenance records have used this item yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
