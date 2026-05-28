import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { FacturaForm } from "@/components/factura-form";

export const dynamic = "force-dynamic";

export default async function NewFacturaPage() {
  const [assets, stockItems] = await Promise.all([
    prisma.device.findMany({ orderBy: { name: "asc" } }),
    prisma.stockItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Add Factura" description="Create a purchase record and attach a PDF or photo." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <FacturaForm assets={assets} stockItems={stockItems} />
      </div>
    </div>
  );
}
