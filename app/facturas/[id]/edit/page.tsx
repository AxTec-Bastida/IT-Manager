import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { FacturaForm } from "@/components/factura-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditFacturaPage({ params }: Props) {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Editing facturas requires IT Staff or Admin access." />;
  const { id } = await params;
  const [factura, assets, stockItems] = await Promise.all([
    prisma.factura.findUnique({ where: { id }, include: { assets: true, stockItems: true } }),
    prisma.device.findMany({ orderBy: { name: "asc" } }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!factura) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${factura.facturaNumber}`} description="Update purchase details, attachment, and linked records." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <FacturaForm factura={factura} assets={assets} stockItems={stockItems} />
      </div>
    </div>
  );
}
