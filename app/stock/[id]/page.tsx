import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Edit, PackageCheck, PackagePlus, ReceiptText, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { StockMovementForm } from "@/components/stock-movement-form";
import { DataQualityActionButton } from "@/components/data-quality-actions";
import { StockItemPhotoPanel } from "@/components/stock-item-photo-panel";
import { categoryLabels, stockCategoryLabels, stockItemTypeLabels, stockMovementTypeLabels } from "@/lib/constants";
import { detectSuspiciousStockComments } from "@/lib/data-quality";
import { suggestStockCategory } from "@/lib/stock-classification";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StockDetailPage({ params }: Props) {
  const { id } = await params;
  const [stockItem, employees, facturas] = await Promise.all([
    prisma.stockItem.findUnique({
      where: { id },
      include: {
        factura: true,
        photos: { orderBy: { createdAt: "desc" } },
        movements: { orderBy: { createdAt: "desc" }, take: 25, include: { asset: true, employee: true, factura: true } },
        maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 25, include: { asset: true } },
        stockIssues: { orderBy: { issuedAt: "desc" }, take: 10, include: { employee: true, temporaryBorrower: true } },
        alerts: { where: { status: "OPEN" }, orderBy: { lastSeenAt: "desc" } },
        _count: { select: { movements: true, maintenanceRecords: true, stockIssues: true, purchaseNoteItems: true } },
      },
    }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    prisma.factura.findMany({ where: { status: "ACTIVE" }, orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  if (!stockItem) notFound();

  const lowStock = stockItem.quantityOnHand <= stockItem.minimumQuantity;
  const suggestion = suggestStockCategory(stockItem);
  const hasCategorySuggestion = suggestion && suggestion.category !== stockItem.category;
  const suspiciousStock = detectSuspiciousStockComments([stockItem])[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={stockItem.name}
        description={`${stockCategoryLabels[stockItem.category]} / ${stockItemTypeLabels[stockItem.itemType]}`}
        action={
          <div className="grid gap-2 sm:flex">
            <Link href={`/tasks/new?relatedStockItemId=${stockItem.id}&category=STOCK&title=${encodeURIComponent(`Follow up ${stockItem.name}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ClipboardList size={16} />
              Create Task
            </Link>
            <Link href={`/po-tracker/new?relatedStockItemId=${stockItem.id}&title=${encodeURIComponent(`Order ${stockItem.name}`)}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <ReceiptText size={16} />
              PO Note
            </Link>
            {stockItem.active ? (
              <>
                <Link href={`/stock/issue?stockItemId=${stockItem.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <PackageCheck size={16} />
                  Issue / Loan
                </Link>
                <Link href={`/labels?mode=stock&stockItemId=${stockItem.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <Printer size={16} />
                  Print Label
                </Link>
              </>
            ) : null}
            <Link href={`/stock/${stockItem.id}/edit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
              <Edit size={16} />
              Edit
            </Link>
          </div>
        }
      />

      {!stockItem.active ? (
        <section className="rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Archived stock item</h2>
              <p className="mt-1 text-sm text-slate-600">This item is hidden from normal stock lists and cannot be issued or loaned while archived.</p>
            </div>
            <Badge className="w-fit bg-slate-100 text-slate-700 ring-slate-200">Archived</Badge>
          </div>
        </section>
      ) : null}

      {suspiciousStock || hasCategorySuggestion ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Cleanup review</h2>
              {suspiciousStock ? <p className="mt-1 text-sm text-slate-700">{suspiciousStock.reason}</p> : null}
              {hasCategorySuggestion ? <p className="mt-1 text-sm text-slate-700">Suggested category: {stockCategoryLabels[suggestion.category]} because {suggestion.reason.toLowerCase()}</p> : null}
            </div>
            {hasCategorySuggestion ? (
              <DataQualityActionButton
                endpoint={`/api/data-quality/stock/${stockItem.id}/apply-suggested-category`}
                label="Apply category"
                confirmText={`Change ${stockItem.name} category to ${stockCategoryLabels[suggestion.category]}? Quantity and history will not change.`}
                successText="Stock category updated."
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {lowStock ? <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Low stock</Badge> : <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">In stock</Badge>}
            {!stockItem.active ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Inactive</Badge> : null}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["SKU", stockItem.sku || "-"],
              ["Scan code", stockItem.barcodeValue || "-"],
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
          {stockItem.active ? (
            <>
              <p className="mt-1 text-sm text-slate-500">Every change creates a stock movement history row.</p>
              <div className="mt-4">
                <StockMovementForm stockItem={stockItem} employees={employees} facturas={facturas} />
              </div>
            </>
          ) : (
            <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600">Archived stock cannot be adjusted from this page. Restore it first if this is a real stock item.</p>
          )}
        </div>
      </section>

      <StockItemPhotoPanel stockItemId={stockItem.id} photos={stockItem.photos} />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Recent issues / loans</h2>
            <Link href={`/stock/issues?q=${encodeURIComponent(stockItem.name)}`} className="text-sm font-semibold text-slate-700 hover:text-slate-950">View all</Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {stockItem.stockIssues.map((issue) => (
              <Link key={issue.id} href={`/stock/issues/${issue.id}`} className="block py-3 text-sm hover:bg-slate-50">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-slate-950">{issue.issueNumber || issue.issueType}</p>
                  <p className="text-slate-500">{issue.issuedAt.toLocaleString()}</p>
                </div>
                <p className="text-slate-600">
                  {issue.issueType.replaceAll("_", " ")} / {issue.quantity} issued / {issue.status.replaceAll("_", " ")}
                </p>
                <p className="text-slate-500">{issue.employee?.fullName || issue.temporaryBorrower?.name || "Unknown borrower"}</p>
              </Link>
            ))}
            {stockItem.stockIssues.length === 0 ? <p className="text-sm text-slate-500">No issue or loan history yet.</p> : null}
          </div>
        </div>

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
                  Qty: {movement.previousQuantity} &rarr; {movement.newQuantity} ({movement.newQuantity - movement.previousQuantity > 0 ? `+${movement.quantity}` : movement.newQuantity - movement.previousQuantity < 0 ? `-${movement.quantity}` : "0"})
                  {movement.asset ? ` / ${movement.asset.name}` : ""}
                  {movement.employee ? ` / ${movement.employee.fullName}` : ""}
                  {movement.factura ? ` / ${movement.factura.facturaNumber}` : ""}
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
                <p className="text-slate-600">{record.maintenanceType.replaceAll("_", " ")} / Qty {record.quantityUsed ?? 0}</p>
              </Link>
            ))}
            {stockItem.maintenanceRecords.length === 0 ? <p className="text-sm text-slate-500">No maintenance records have used this item yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
