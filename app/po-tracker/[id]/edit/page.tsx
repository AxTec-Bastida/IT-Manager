import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { PurchaseNoteForm } from "@/components/purchase-note-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditPoTrackerPage({ params }: Props) {
  const { id } = await params;
  const [purchaseNote, facturas, stockItems, devices] = await Promise.all([
    prisma.purchaseNote.findUnique({ where: { id }, include: { items: true } }),
    prisma.factura.findMany({ where: { status: "ACTIVE" }, orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], select: { id: true, facturaNumber: true, vendorName: true } }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    prisma.device.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, assetTag: true } }),
  ]);
  if (!purchaseNote) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit PO note" description={purchaseNote.title} />
      <PurchaseNoteForm purchaseNote={purchaseNote} facturas={facturas} stockItems={stockItems} devices={devices} />
    </div>
  );
}
