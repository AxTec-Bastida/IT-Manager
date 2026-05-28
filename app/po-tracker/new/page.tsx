import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { PurchaseNoteForm } from "@/components/purchase-note-form";

export const dynamic = "force-dynamic";

export default async function NewPoTrackerPage() {
  const [facturas, stockItems, devices] = await Promise.all([
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], select: { id: true, facturaNumber: true, vendorName: true } }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    prisma.device.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, assetTag: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="New PO note" description="Track a purchase request, vendor follow-up, or factura status." />
      <PurchaseNoteForm facturas={facturas} stockItems={stockItems} devices={devices} />
    </div>
  );
}
