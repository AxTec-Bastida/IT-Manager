import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StockCountForm } from "@/components/stock-count-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockCountPage({ searchParams }: Props) {
  if (!(await hasPagePermission("stock.write"))) {
    return <ForbiddenPanel message="Performing stock audits or adjustments requires IT Staff or Admin access." />;
  }
  const params = await searchParams;
  const initialStockItemId = typeof params.stockItemId === "string" ? params.stockItemId : "";

  const stockItems = await prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Physical Count / Adjustment" 
        description="Correct system quantities after counting shelf stock or identifying damaged/lost items." 
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <StockCountForm 
          stockItems={stockItems} 
          initialStockItemId={initialStockItemId} 
        />
      </div>
    </div>
  );
}
