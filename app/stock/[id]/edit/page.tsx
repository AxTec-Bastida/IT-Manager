import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockItemForm } from "@/components/stock-item-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditStockPage({ params }: Props) {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Editing stock items requires IT Staff or Admin access." />;
  const { id } = await params;
  const [stockItem, facturas, deviceModels, stockItems] = await Promise.all([
    prisma.stockItem.findUnique({ where: { id } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
    prisma.device.findMany({ select: { model: true }, distinct: ["model"], where: { AND: [{ model: { not: null } }, { model: { not: "" } }] } }),
    prisma.stockItem.findMany({ select: { name: true }, distinct: ["name"], where: { active: true } }),
  ]);
  if (!stockItem) notFound();

  const models = deviceModels.map((d) => d.model).filter((m): m is string => Boolean(m));
  const stockNames = stockItems.map((s) => s.name);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${stockItem.name}`} description="Update stock item details, compatibility, storage, and thresholds." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <StockItemForm 
          stockItem={stockItem} 
          facturas={facturas} 
          deviceModels={models}
          stockItems={stockNames}
        />
      </div>
    </div>
  );
}
