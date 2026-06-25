import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { IntakeStockForm } from "@/components/intake-stock-form";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function StockIntakePage() {
  if (!(await hasPagePermission("stock.write"))) return <ForbiddenPanel message="Stock intake requires IT Staff or Admin access." />;
  const [stockItems, facturas] = await Promise.all([
    prisma.stockItem.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, barcodeValue: true, quantityOnHand: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.factura.findMany({ where: { status: "ACTIVE" }, orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Intake"
        description="Receive quantity-based consumables and peripherals, then update on-hand quantity with movement history."
        action={
          <Link href="/intake" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Intake hub
          </Link>
        }
      />
      <IntakeStockForm stockItems={stockItems} facturas={facturas} />
    </div>
  );
}
