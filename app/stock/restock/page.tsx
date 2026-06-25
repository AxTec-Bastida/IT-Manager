import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockRestockForm } from "@/components/stock-restock-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockRestockPage({ searchParams }: Props) {
  if (!(await hasPagePermission("stock.write"))) {
    return <ForbiddenPanel message="Restocking items requires IT Staff or Admin access." />;
  }
  const params = await searchParams;
  const initialStockItemId = typeof params.stockItemId === "string" ? params.stockItemId : "";

  const [stockItems, facturas] = await Promise.all([
    prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.factura.findMany({ where: { status: "ACTIVE" }, orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Restock Existing Item" 
        description="Add quantity to an item already tracked in stock. Update pricing or location if needed." 
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <StockRestockForm 
          stockItems={stockItems} 
          facturas={facturas} 
          initialStockItemId={initialStockItemId} 
        />
      </div>
    </div>
  );
}
