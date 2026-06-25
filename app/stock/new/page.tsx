import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockItemForm } from "@/components/stock-item-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function NewStockPage() {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Adding stock items requires IT Staff or Admin access." />;
  const [settings, facturas, deviceModels, stockItems] = await Promise.all([
    prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
    prisma.device.findMany({ select: { model: true }, distinct: ["model"], where: { AND: [{ model: { not: null } }, { model: { not: "" } }] } }),
    prisma.stockItem.findMany({ select: { name: true }, distinct: ["name"], where: { active: true } }),
  ]);
  
  const models = deviceModels.map((d) => d.model).filter((m): m is string => Boolean(m));
  const stockNames = stockItems.map((s) => s.name);

  return (
    <div className="space-y-6">
      <PageHeader title="Add Stock Item" description="Create a quantity-tracked consumable, peripheral, supply, or maintenance part." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <StockItemForm 
          defaults={{ currency: settings.defaultCurrency, minimumQuantity: settings.defaultLowStockThreshold }} 
          facturas={facturas} 
          deviceModels={models}
          stockItems={stockNames}
        />
      </div>
    </div>
  );
}
