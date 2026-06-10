import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { FacturaForm } from "@/components/factura-form";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function NewFacturaPage() {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Creating facturas requires IT Staff or Admin access." />;
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
