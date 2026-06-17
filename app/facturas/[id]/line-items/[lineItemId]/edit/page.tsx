import Link from "next/link";
import { notFound } from "next/navigation";
import { FacturaLineItemForm } from "@/components/factura-line-item-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string; lineItemId: string }> };

export default async function EditFacturaLineItemPage({ params }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Editing factura line items requires IT Staff or Admin access." />;
  const { id, lineItemId } = await params;
  const lineItem = await prisma.facturaLineItem.findFirst({ where: { id: lineItemId, facturaId: id }, include: { factura: true } });
  if (!lineItem) notFound();

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Edit Line Item"
        description={`${lineItem.factura.facturaNumber} / ${lineItem.description}`}
        action={<Link href={`/facturas/${id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Back to factura</Link>}
      />
      <FacturaLineItemForm facturaId={id} lineItem={lineItem} />
    </div>
  );
}
