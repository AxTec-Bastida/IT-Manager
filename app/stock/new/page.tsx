import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockItemForm } from "@/components/stock-item-form";

export const dynamic = "force-dynamic";

export default async function NewStockPage() {
  const [settings, facturas] = await Promise.all([
    prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }),
    prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Add Stock Item" description="Create a quantity-tracked consumable, peripheral, supply, or maintenance part." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <StockItemForm defaults={{ currency: settings.defaultCurrency, minimumQuantity: settings.defaultLowStockThreshold }} facturas={facturas} />
      </div>
    </div>
  );
}
