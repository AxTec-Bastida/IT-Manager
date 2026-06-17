import Link from "next/link";
import { notFound } from "next/navigation";
import { FacturaLineItemForm } from "@/components/factura-line-item-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { hasPagePermission } from "@/lib/page-permissions";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export default async function NewFacturaLineItemPage({ params }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Adding factura line items requires IT Staff or Admin access." />;
  const { id } = await params;
  const factura = await prisma.factura.findUnique({ where: { id } });
  if (!factura) notFound();

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Add Line Item"
        description={`${factura.facturaNumber} / ${factura.vendorName}`}
        action={<Link href={`/facturas/${factura.id}`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">Back to factura</Link>}
      />
      <FacturaLineItemForm facturaId={factura.id} />
    </div>
  );
}
